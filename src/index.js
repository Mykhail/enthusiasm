import 'regenerator-runtime/runtime';
import getConfig from './config.js';
import * as nearAPI from 'near-api-js';
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

async function initContract() {
    const nearConfig = getConfig(process.env.NEAR_ENV || 'testnet');

    // create a keyStore from the browser local storage after user logs in
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();

    // Initializing connection to the NEAR
    const near = await nearAPI.connect({ keyStore, ...nearConfig });

    // Init wallet connection
    const walletConnection = new nearAPI.WalletConnection(near);

    // Load in user's account data
    let currentUser;
    if (walletConnection.getAccountId()) {
        currentUser = {
            // Gets the accountId as a string
            accountId: walletConnection.getAccountId(),
            // Gets the user's token balance
            balance: (await walletConnection.account().state()).amount,
        };
    }

    // Initializing our contract APIs by contract name and configuration
    const contract = await new nearAPI.Contract(
        // User's accountId as a string
        walletConnection.account(),
        nearConfig.contractName,
        {
            // View methods are read-only – they don't modify the state, but usually return some value
            viewMethods: ['hello_world', 'get_data'],
            // Change methods can modify the state, but you don't receive the returned value when called
            changeMethods: ['set_data'],
            // Sender is the account ID to initialize transactions.
            // getAccountId() will return empty string if user is still unauthorized
            sender: walletConnection.getAccountId(),
        }
    );

    return { contract, currentUser, nearConfig, walletConnection };
}

const signIn = (nearConfig, walletConnection) => {
    walletConnection.requestSignIn(
        nearConfig.contractName, // contract requesting access
        "Example App", // optional
        nearConfig.endpoints.signInSuccess.replace('[slackId]', getSlackId()), // optional - success
        nearConfig.endpoints.signInFailure // optional - failure
    );
};

async function sendMoney(walletConnection, amountToSend) {
    const nearConfig = getConfig(process.env.NEAR_ENV || 'testnet');
    const amountInYocto = nearAPI.utils.format.parseNearAmount(amountToSend);
    await walletConnection.account().sendMoney(
        nearConfig.contractName, // receiver account
        amountInYocto // amount in yoctoNEAR
    );
}

function getcontext() {
    let rawContext = document.getElementById('main').dataset.context;
    let context;

    try{ context = JSON.parse(atob(rawContext)); } catch(e) { context = {}; }

    return context;
}

function getSlackId() {
    const context = getcontext();

    return context.slackId;
}

window.nearInitPromise = initContract().then(
    async ({ contract, currentUser, nearConfig, walletConnection }) => {
        let context = getcontext();

        switch (context.action) {
            case 'getAccountId':
                if (!walletConnection.getAccountId()) {
                    signIn(nearConfig, walletConnection);
                } else {
                    let successEndpoint = nearConfig.endpoints.signInSuccess.replace('[slackId]', getSlackId());
                    let redirectLink = `${successEndpoint}?account_id=${walletConnection.getAccountId()}`;
                    location.href = redirectLink;
                    document.getElementById('root').innerHTML = `Please visit: <a href="${redirectLink}">Near wallet</a>`;
                }
                break;
            case 'retainAccountId':
                if (!walletConnection.getAccountId()) {
                    let successEndpoint = nearConfig.endpoints.signInSuccess.replace('[slackId]', getSlackId());
                    let redirectLink = `${successEndpoint}?account_id=${walletConnection.getAccountId()}`;
                    document.getElementById('root').innerHTML = 
                        `Wallet Authentication error, Please visit: <a href="${redirectLink}">Near wallet</a>`;
                } else {
                    document.getElementById('root').innerHTML = `You have successfully authenticated`;
                }
                break;
            case 'sendMoney':
                const targetAccountId = context.targetAccountId || localStorage.getItem('targetAccountId');
                const amount = context.amount || localStorage.getItem('amount');
                if (!targetAccountId || !amount) {
                    document.getElementById('root').innerHTML = `Invalid operation`;
                } else if (!walletConnection.getAccountId()) {
                    localStorage.setItem('targetAccountId', targetAccountId);
                    localStorage.setItem('amount', amount);
                    const successEndpoint = `${nearConfig.endpoints.apiHost}/sendMoney`;
                    const signInConfig = Object.assign({}, nearConfig);
                    signInConfig.endpoints.signInSuccess = successEndpoint;
                    signIn(signInConfig, walletConnection);
                } else {
                    sendMoney(walletConnection, amount);
                    localStorage.setItem('targetAccountId', '');
                    localStorage.setItem('amount', '');
                }
                break;
            default:
                document.getElementById('root').innerHTML = `Linked AccountId: ${walletConnection._connectedAccount.accountId}`;
                break;
        }
    }
);
