use std::convert::TryFrom;

use near_sdk::collections::{LookupMap};
use near_sdk::{near_bindgen, AccountId, PanicOnDefault, env, Balance, log};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::json_types::ValidAccountId;

pub type TokenAccountId = AccountId;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct  Contract {
    slack_and_wallet: LookupMap<String,AccountId>,
    master_account_id: AccountId,
    deposits: LookupMap<AccountId, Balance>
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(master_account_id: AccountId) -> Self {
        Self {
            slack_and_wallet: LookupMap::new(b"c"),
            master_account_id: master_account_id.into(),
            deposits: LookupMap::new(b"u")
        }
    }

    pub fn connect_slack_with_wallet(&mut self, slack_account_id: String, near_account_id: AccountId) {
        self.slack_and_wallet.insert(&slack_account_id, &near_account_id);
    }

    pub fn has_wallet_associated(&self, slack_account_id: String) -> AccountId {
        self.slack_and_wallet.get(&slack_account_id).unwrap().into()
    }

    pub fn get_balance(&self, near_account_id: AccountId) -> Balance {
        self.deposits.get(&near_account_id).unwrap_or(0).into()
    }

    #[payable]
    pub fn deposit(&mut self, near_account_id: Option<ValidAccountId>) {
        let account_id_prepared: ValidAccountId = near_account_id.unwrap_or(
            ValidAccountId::try_from(env::predecessor_account_id()).unwrap()
        );
        log!("Account id {} is trying to do something with attached deposit {}", account_id_prepared, env::attached_deposit());

        let attached_deposit: Balance = env::attached_deposit();

        self.deposit_amount_to_account(account_id_prepared.as_ref(), attached_deposit);
    }

    pub(crate) fn deposit_amount_to_account(&mut self, account_id: &AccountId, amount: Balance) {
        self.increase_deposit(account_id.clone(), amount);
    }

    pub(crate) fn increase_deposit(&mut self, account_id: AccountId, amount: Balance) {
        let sender_deposit: Balance = self.deposits.get(&account_id).unwrap_or(0);
        self.deposits.insert(&account_id, &(sender_deposit + amount));
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
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
    use near_sdk::{testing_env, AccountId};

    // part of writing unit tests is setting up a mock context
    // provide a `predecessor` here, it'll modify the default context
    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    // TESTS HERE
}
