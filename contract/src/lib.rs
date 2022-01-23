use near_sdk::collections::{LookupMap};
use near_sdk::{near_bindgen, AccountId, PanicOnDefault};
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};


#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct  Contract {
    slack_and_wallet: LookupMap<String,AccountId>,
    master_account_id: AccountId
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(master_account_id: AccountId) -> Self {
        Self {
            slack_and_wallet: LookupMap::new(b"c"),
            master_account_id: master_account_id.into()
        }
    }

    pub fn connect_slack_with_wallet(&mut self, slack_account_id: String, near_account_id: AccountId) {
        self.slack_and_wallet.insert(&slack_account_id, &near_account_id);
    }

    pub fn has_wallet_associated(&self, slack_account_id: String) -> AccountId {
        self.slack_and_wallet.get(&slack_account_id).unwrap().into()
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
