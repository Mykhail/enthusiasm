import 'regenerator-runtime/runtime';
import * as nearAPI from 'near-api-js';

async function initContract(nearConfig) {
    const keyStore = new nearAPI.keyStores.BrowserLocalStorageKeyStore();
    const near = await nearAPI.connect({ keyStore, ...nearConfig });
    const walletConnection = new nearAPI.WalletConnection(near);

    return { nearConfig, walletConnection };
}

const signIn = (nearConfig, walletConnection) => {
    // direct callback endpoints stopped working on 2022-02-08
    // walletConnection.requestSignIn(
    //     nearConfig.contractName, // contract requesting access
    //     "Example App", // optional
    //     nearConfig.endpoints.signInSuccess.replace('[slackId]', getSlackId()), // optional - success
    //     nearConfig.endpoints.signInFailure // optional - failure
    // );
    walletConnection.requestSignIn(
        nearConfig.contractName // contract requesting access
    );
};

async function sendMoney(contractName, walletConnection, amountToSend) {
    const amountInYocto = nearAPI.utils.format.parseNearAmount(amountToSend);
    await walletConnection.account().sendMoney(
        contractName, // receiver account
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

function showError(errorMsg) {
    const el = document.getElementById('root');
    const wrapper = document.getElementById('wrapper');
    el.innerHTML = errorMsg;
    wrapper.classList.add('error');
}



(async () => {
    const context = getcontext();
    if (!context.nearConfig) {
        throw 'Initialization failed: context.nearConfig is empty';
    }
    const { nearConfig, walletConnection } = await initContract(context.nearConfig);

    switch (context.action) {
        case 'createNomination':
            const depositAmount = context.depositAmount;
            if (!depositAmount) {
                showError(`Invalid operation`);
            } else if (!walletConnection.getAccountId()) {
                signIn(nearConfig, walletConnection);
            } else {
                sendMoney(nearConfig.contractName, walletConnection, depositAmount);
            }
            break;
        case 'voteForSlackId':
            if (!walletConnection.getAccountId()) {
                signIn(nearConfig, walletConnection);
            } else {
                const account = await walletConnection.account(walletConnection.getAccountId());
                const methodName = context.methodName;
                const ownerSlackId = context.ownerSlackId;
                const votedForSlackId = context.votedForSlackId;
                try {
                    const result = await account.signAndSendTransaction({
                        receiverId: nearConfig.contractName,
                        actions: [
                            nearAPI.transactions.functionCall(
                                methodName,
                                {owner: ownerSlackId, vote: votedForSlackId},
                                100000000000000,
                                '0'
                            ),
                        ],
                    });
                    
                    const transactionHashes = result?.transaction?.hash;
                    if (transactionHashes) {
                        location.href = `${location.origin}${location.pathname}/?transactionHashes=${transactionHashes}`;
                    } else {
                        showError(`Request failed, please try again later.`);
                    }
                } catch (error) {
                    console.log("call failed: ", error);
                    showError(`Request failed, please try again later.`);
                }
            }
            break;
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
        case 'processAccountId':
            if (!walletConnection.getAccountId()) {
                let successEndpoint = nearConfig.endpoints.signInSuccess.replace('[slackId]', getSlackId());
                let redirectLink = `${successEndpoint}?account_id=${walletConnection.getAccountId()}`;
                document.getElementById('root').innerHTML = 
                    `Wallet Authentication error, Please visit: <a href="${redirectLink}">Near wallet</a>`;
            } else {
                const authenticatedEl = document.getElementById('authenticated');
                authenticatedEl.classList.remove('hidden');
                authenticatedEl.classList.add('visible');
            }
            break;
        case 'sendMoney':
            const targetSlackId = context.targetSlackId || localStorage.getItem('targetSlackId');
            const targetAccountId = context.targetAccountId || localStorage.getItem('targetAccountId');
            const amount = context.amount || localStorage.getItem('amount');
            if (!targetAccountId || !amount || !targetSlackId) {
                showError(`Invalid operation`);
            } else if (!walletConnection.getAccountId()) {
                localStorage.setItem('targetSlackId', targetSlackId);
                localStorage.setItem('targetAccountId', targetAccountId);
                localStorage.setItem('amount', amount);
                signIn(nearConfig, walletConnection);
            } else {
                sendMoney(nearConfig.contractName, walletConnection, amount);
                localStorage.setItem('targetSlackId', '');
                localStorage.setItem('targetAccountId', '');
                localStorage.setItem('amount', '');
            }
            break;
        case 'showTransactionConfirmation':
            const transactionConfirmed = document.getElementById('transactionConfirmed');
            transactionConfirmed.classList.remove('hidden');
            transactionConfirmed.classList.add('visible');
            break;
        default:
            document.getElementById('root').innerHTML = `Linked AccountId: ${walletConnection._connectedAccount.accountId}`;
            break;
    }
})();
