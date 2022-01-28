use near_contract_standards::fungible_token::core_impl::ext_fungible_token;
use near_sdk::collections::{LookupMap};
use near_sdk::json_types::WrappedBalance;
use near_sdk::{near_bindgen, AccountId, PanicOnDefault, env, Balance, BorshStorageKey, Gas, Promise, ext_contract, PromiseResult, log};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};

pub type TokenAccountId = AccountId;
pub type SlackAccountId = String;

const GAS_FOR_AFTER_FT_TRANSFER: Gas = 25_000_000_000_000;
const GAS_FOR_FT_TRANSFER: Gas = 25_000_000_000_000;
const ONE_YOCTO: Balance = 1;
const NO_DEPOSIT: Balance = 0;
const NEAR: &str = "near";

#[derive(BorshStorageKey, BorshSerialize)]
pub (crate) enum StorageKey {
    Rewards,
    SlackAccounts
}

#[ext_contract(ext_self)]
pub trait ExtNearTips {
    fn after_ft_transfer_balance(&mut self, slack_account_id: SlackAccountId, amount: Balance) -> bool;
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

    #[payable]
    pub fn send_reward(&mut self, slack_account_id: SlackAccountId) {
        let attached_deposit: Balance = env::attached_deposit();

        let recipient_rewards: Balance = self.rewards.get(&slack_account_id).unwrap_or(0);
        self.rewards.insert(&slack_account_id, &(recipient_rewards + attached_deposit));
    }

    pub fn withdraw_rewards(&mut self, slack_account_id: SlackAccountId) -> Promise {
        self.assert_master_account();

        let rewards: Balance = self.get_rewards(slack_account_id.clone()).0;

        let account_id: AccountId = self.slack_wallets.get(&slack_account_id).unwrap_or(AccountId::new());

        env::log(format!("@{} is withdrawing {} from slack account {}",
            account_id, rewards, slack_account_id).as_bytes());
        // zero balance
        self.rewards.insert(&slack_account_id, &0);

        ext_fungible_token::ft_transfer(
            account_id, 
            rewards.into(), 
            Some(format!(
                "Withdrawing rewards from @{}",
                env::current_account_id()
            )), 
            &env::predecessor_account_id(), 
            ONE_YOCTO, 
            GAS_FOR_FT_TRANSFER
        ).then(ext_self::after_ft_transfer_balance(
            slack_account_id,
            rewards.into(),
            &env::current_account_id(),
            NO_DEPOSIT,
            GAS_FOR_AFTER_FT_TRANSFER,
        ))
    }

    pub fn after_ft_transfer_balance(
        &mut self,
        slack_account_id: SlackAccountId,
        amount: WrappedBalance,
    ) -> bool {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Callback can only be called from the contract"
        );
        log!("Just after ft transfer log");
        let promise_success = is_promise_success();
        if !is_promise_success() {
            log!("Near withdraw by slack account {} failed. Amount to recharge: {}", slack_account_id, amount.0);
            self.rewards.insert(&slack_account_id, &amount.0);
        }

        promise_success
    }


    pub fn get_rewards(&self, slack_account_id: SlackAccountId) -> WrappedBalance {
        self.rewards.get(&slack_account_id).unwrap_or(0).into()
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
        let contract = Contract::new();
        (context, contract)
    }

}
