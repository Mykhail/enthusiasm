use near_sdk::collections::{LookupMap};
use near_sdk::json_types::WrappedBalance;
use near_sdk::{near_bindgen, AccountId, PanicOnDefault, env, Balance, BorshStorageKey, Gas, Promise, ext_contract, PromiseResult, log};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};

pub type TokenAccountId = AccountId;
pub type SlackAccountId = String;

const CALLBACK_GAS: Gas = 25_000_000_000_000;
const EMPTY_BALANCE: Balance = 0;

#[derive(BorshStorageKey, BorshSerialize)]
pub (crate) enum StorageKey {
    Rewards,
    SlackAccounts
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
    master_account_id: AccountId
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(master_account_id: AccountId) -> Self {
        Self {
            rewards: LookupMap::new(StorageKey::Rewards),
            slack_wallets: LookupMap::new(StorageKey::SlackAccounts),
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
    use near_sdk::test_utils::{get_logs, VMContextBuilder, accounts};
    use near_sdk::{testing_env, AccountId, MockedBlockchain};

    fn setup_contract() -> (VMContextBuilder, Contract) {
        let mut context = VMContextBuilder::new();
        testing_env!(context.predecessor_account_id(accounts(0)).build());
        let contract = Contract::new("sergey_shpota.testnet".to_string());
        (context, contract)
    }


    #[test]
    fn test() {
        let (context, mut contract) = setup_contract();
    }
}
