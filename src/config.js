// const CONTRACT_NAME = process.env.CONTRACT_NAME || 'sub.chokobear.testnet';
const CONTRACT_NAME = process.env.CONTRACT_NAME || 'chokobear.testnet';
const path = require("path");
const apiHost = process.env.APIHOST || 'http://localhost:3000';
const credentialsPath = path.join(require("os").homedir(), '.near-credentials');
const ENDPOINTS = {
    apiHost: apiHost,
    signIn: apiHost,
    signInSuccess: `${apiHost}/processAccountId/[slackId]`,
    signInFailure: `${apiHost}/signInFailure`
};

function getConfig(env) {
    switch(env) {
        case 'mainnet':
            return {
                networkId: 'mainnet',
                nodeUrl: 'https://rpc.mainnet.near.org',
                contractName: CONTRACT_NAME,
                endpoints: ENDPOINTS,
                credentialsPath: credentialsPath,
                walletUrl: 'https://wallet.near.org',
                helperUrl: 'https://helper.mainnet.near.org'
            };
        // This is an example app so production is set to testnet.
        // You can move production to mainnet if that is applicable.
        case 'production':
        case 'development':
        case 'testnet':
            return {
                networkId: 'testnet',
                nodeUrl: 'https://rpc.testnet.near.org',
                contractName: CONTRACT_NAME,
                endpoints: ENDPOINTS,
                credentialsPath: credentialsPath,
                walletUrl: 'https://wallet.testnet.near.org',
                helperUrl: 'https://helper.testnet.near.org'
            };
        default:
            throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`);
    }
}

module.exports = getConfig;
