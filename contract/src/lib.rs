use near_sdk::collections::{LookupMap};
use near_sdk::json_types::WrappedBalance;
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault, Balance, BorshStorageKey, Gas, Promise, ext_contract, PromiseResult, log};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Serialize};

pub type TokenAccountId = AccountId;
pub type SlackAccountId = String;
pub type Votes = u16;

const CALLBACK_GAS: Gas = 25_000_000_000_000;
const EMPTY_BALANCE: Balance = 0;

#[derive(BorshStorageKey, BorshSerialize)]
pub (crate) enum StorageKey {
    Rewards,
    SlackAccounts,
    Nominations
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Nominator {
    slack_user: SlackAccountId,
    votes: Votes
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Nomination {
    pub nominators: Vec<Nominator>,
    pub title: String,
    pub amount: Balance,
    pub is_valid: bool
}

#[derive(BorshDeserialize, BorshSerialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Winner {
    pub winner: SlackAccountId,
    pub nomination: String,
    pub amount: WrappedBalance
}

#[ext_contract(ext_self)]
pub trait ExtNearTips {
    fn on_withdraw_rewards(&mut self, recipient_account_id: AccountId, rewards: Balance) -> bool;
}

fn is_promise_success() -> bool {
    assert_eq!(
        env::promise_results_count(),
        1,
        "Contract expected a result on the callback"
    );
    match env::promise_result(0) {
        PromiseResult::Successful(_) => true,
        _ => false,
    }
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    rewards: LookupMap<SlackAccountId, Balance>,
    slack_wallets: LookupMap<SlackAccountId, AccountId>,
    master_account_id: AccountId,
    nominations: LookupMap<SlackAccountId, Nomination>
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(master_account_id: AccountId) -> Self {
        Self {
            rewards: LookupMap::new(StorageKey::Rewards),
            slack_wallets: LookupMap::new(StorageKey::SlackAccounts),
            nominations: LookupMap::new(StorageKey::Nominations),
            master_account_id: master_account_id.into()
        }
    }

    pub fn get_wallet(&self, slack_account_id: SlackAccountId) -> AccountId {
        self.slack_wallets.get(&slack_account_id).unwrap_or(AccountId::new()).into()
    }

    pub fn associate_wallet_with_slack(&mut self, slack_account_id: SlackAccountId, near_account_id: AccountId) {
        self.slack_wallets.insert(&slack_account_id, &near_account_id);
    }

    pub fn get_rewards(&self, slack_account_id: SlackAccountId) -> WrappedBalance {
        self.rewards.get(&slack_account_id).unwrap_or(0).into()
    }

    #[payable]
    pub fn send_reward(&mut self, slack_account_id: SlackAccountId) {
        let attached_deposit: Balance = env::attached_deposit();
        let recipient_rewards: Balance = self.rewards.get(&slack_account_id).unwrap_or(0);
        self.rewards.insert(&slack_account_id, &(recipient_rewards + attached_deposit));
    }

    pub fn withdraw_rewards(&mut self, slack_account_id: SlackAccountId) -> Promise {
        self.assert_master_account();

        let recipient_account_id: AccountId = self.slack_wallets.get(&slack_account_id).unwrap_or(AccountId::new());
        assert_ne!(recipient_account_id, AccountId::new(), "Wrong slack account id");

        let rewards: Balance = self.get_rewards(slack_account_id.clone()).0;
        assert!(rewards != EMPTY_BALANCE, "Nothing to withdraw");

        env::log(format!("@{} is withdrawing rewards {} NEAR from slack account {}", recipient_account_id, rewards, slack_account_id).as_bytes());
        // zero balance
        self.rewards.insert(&slack_account_id, &0);

        Promise::new(recipient_account_id.clone())
            .transfer(rewards)
            .then(ext_self::on_withdraw_rewards(
                recipient_account_id.clone(), 
                rewards, 
                &env::current_account_id(), 
                0, 
                CALLBACK_GAS
            ))
    }

    pub fn on_withdraw_rewards(&mut self, recipient_account_id: AccountId, rewards: Balance) -> bool {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Callback can only be called from the contract"
        );

        let withdraw_succeeded = is_promise_success();
        if !is_promise_success() {
            log!("Near withdraw by slack account {} failed. Amount to recharge: {}", recipient_account_id, rewards);
            self.rewards.insert(&recipient_account_id, &rewards);
        }
        withdraw_succeeded
    }

    #[payable]
    pub fn create_nomination(&mut self, owner: SlackAccountId, title: String) {
        assert_eq!(self.nominations.get(&owner), None, "Nomination alredy exists for current slack user");
        assert!(env::attached_deposit() > 0, "Nomination amount must be greater than zero");
        let nomination: Nomination = Nomination{
            nominators: vec![],
            title: title,
            amount: env::attached_deposit(),
            is_valid: true
        };
        self.nominations.insert(&owner, &nomination);
    }

    pub fn get_nomination(&self, owner: SlackAccountId) -> Nomination {
        self.nominations.get(&owner).unwrap_or(Nomination{
            nominators: vec![],
            title: "".to_string(),
            amount: 0,
            is_valid: false
        })
    }

    pub fn add_vote(&mut self, owner: SlackAccountId, vote: SlackAccountId) {
        let mut nomination: Nomination = self.nominations.get(&owner).unwrap_or_else(|| env::panic("Nomination not found".as_bytes()));
        let mut found_vote = false;
        for mut nominator in nomination.nominators.iter_mut() {
            if nominator.slack_user == vote {
                nominator.votes = nominator.votes + 1;
                found_vote = true;
                break
            }
        }
        if !found_vote {
            nomination.nominators.push(Nominator{
                slack_user: vote,
                votes: 1
            })
        }
        self.nominations.insert(&owner, &nomination);
    }

    pub fn finish_nomination(&mut self, owner: SlackAccountId) -> Winner {
        self.assert_master_account();
        let nomination = self.nominations.get(&owner).unwrap_or_else(|| env::panic("Nomination not found".as_bytes()));
        let mut best_result = 0;
        let mut winner: SlackAccountId = "".to_string();
        for nominator in nomination.nominators.iter() {
            if nominator.votes > best_result {
                winner = nominator.slack_user.clone();
                best_result = nominator.votes;
            }
        }
        assert_ne!(winner, "", "No winner found");
        env::log(format!("Winner is {} with the best result {}, assigned {} NEAR to him", winner, best_result, nomination.amount).as_bytes());

        let user_rewards: Balance = self.rewards.get(&winner).unwrap_or(0);
        self.rewards.insert(&winner, &(nomination.amount + user_rewards));
        self.nominations.remove(&owner);

        let winner = Winner{
            winner: winner,
            nomination: nomination.title,
            amount: nomination.amount.into()
        };
        winner
    }

    pub fn assert_master_account(&self) {
        assert_eq!(env::predecessor_account_id(), self.master_account_id, "Access denied");
    }
}

/*
 * the rest of this file sets up unit tests
 * to run these, the command will be:
 * cargo test --package rust-template -- --nocapture
 * Note: 'rust-template' comes from Cargo.toml's 'name' key
 */

// use the attribute below for unit tests
#[cfg(test)]
mod tests {

    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::{testing_env, MockedBlockchain};

    fn setup_contract() -> (VMContextBuilder, Contract) {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(0)).build());
        let contract = Contract::new("master_account.testnet".to_string());
        (context, contract)
    }


    #[test]
    fn test() {
        let (_, mut contract) = setup_contract();

    }
}
