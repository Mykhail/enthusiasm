# Getting Started with ENTHUSIASM

## Available Scripts

In the project directory, you can run:

### `npm run start`

Runs the app server to process slack requests.

### `npm run build:js`

Builds client-side code which will run transactions confirmations and wallet communications on behalf of the user. Will use `./src` as source and put a built version in the `./dist` folder

## Environment variables

NODE\_ENV=`development`

SLACK\_SIGNING\_SECRET=`SECRET`

SLACK\_BOT\_TOKEN=`TOKEN`

PORT=3000

APIHOST=http://localhost:3000

CONTRACT\_NAME=`your contract name`

PRIVATE\_KEY=`your contract's private key from .near-credentials/contract.json. otherwise a file from user .near-credentials will be used`

### Smart contract deployment

### `cd contract`

### `./reload\_contract [AccountId] [ParentAccountId]`

Where AccountId is your target near account to host the contract. ParentAccountId is a parent account, see [https://docs.near.org/docs/concepts/account](<https://docs.near.org/docs/concepts/account>) for more details

