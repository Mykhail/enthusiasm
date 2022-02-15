# near-slack-bot


redirector testing:
    .env file example content:
        NODE_ENV=development
        SLACK_SIGNING_SECRET=12345
        SLACK_BOT_TOKEN=54321
        PORT=3000
        APIHOST=http://localhost:3000
        CONTRACT_NAME=sub.chokobear.testnet
        PRIVATE_KEY=[your contract's private key from .near-credentials/contract.json. otherwise a file from user .near-credentials]

    dev runtime initialization:
        npm i
        npm run build:js
        npm run start

    wallet auth endpoint
        http://localhost:3000/getAccountId/SLACKID

    send money endpoint
        http://localhost:3000/sendMoney/SLACKID/targetNearAccountId/0.3


    Vote for SLACKID endpoint
        http://localhost:3000/voteForSlackId/OWNER_SLACKID/VOTED_FOR_SLACKID

    Create nomination endpoint
        http://localhost:3000/createNomination/OWNER_SLACKID/nominationTitle/depositNearAmount


Smart contract deploy

cd contract
./reload_contract AccountId ParentAccountId

Call contract via CLI

near state contract.sbot.testnet

near view contract.sbot.testnet get_wallet '{"slack_account_id": "test"}'

near call contract.sbot.testnet associate_wallet_with_slack '{"slack_account_id": "test", "near_account_id": "recipient.testnet"}' --accountId sbot.testnet

near view contract.sbot.testnet get_rewards '{"slack_account_id":"test"}'

near call contract.sbot.testnet send_reward '{"slack_account_id": "test"}' --accountId sbot.testnet --deposit 1

near call contract.sbot.testnet withdraw_rewards '{"slack_account_id": "test"}' --accountId sergey_shpota.testnet --gas=75000000000000

near generate-key

near add-key sergey_shpota.testnet ed25519:4n9Kv6UnMfWx5syzgBPQyUz3dFM6WCQ4yNz4JLZWFAbe --contract-id contract.sbot.testnet --allowance 30000000000


near call contract.sbot.testnet create_nomination '{"owner":"test_owner", "title":"Test nomination"}' --accountId sbot.testnet --deposit 1

near view contract.sbot.testnet get_nomination '{"owner":"test_owner"}'

near call contract.sbot.testnet add_vote '{"owner":"test_owner", "vote":"second_user"}' --accountId sbot.testnet

near call contract.sbot.testnet finish_nomination '{"owner":"test_owner"}' --accountId sergey_shpota.testnet --gas=75000000000000