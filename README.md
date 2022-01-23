# near-slack-bot


redirector testing:
    .env file example content:
        NODE_ENV=development
        SLACK_SIGNING_SECRET=12345
        SLACK_BOT_TOKEN=54321
        PORT=3000
        APIHOST=http://localhost:3000
        CONTRACT_NAME=sub.chokobear.testnet

    dev runtime initialization:
        npm i
        npm run build:js
        npm run start

    wallet auth endpoint
        http://localhost:3000/getAccountId?slackId=mockedSlackId

    send money endpoint
        http://localhost:3000/sendMoney?targetAccountId=sub.chokobear.testnet&amount=0.3


Smart contract deploy

cd contract
./reload_contract <AccountId> <ParentAccountId>