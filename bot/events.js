const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const userLoggedIn = true;
const token = process.env.SLACK_BOT_TOKEN;

const { WebClient } = require('@slack/web-api');
const { createEventAdapter } = require('@slack/events-api');
const { createMessageAdapter } = require('@slack/interactive-messages');
const { utils } = require("near-api-js");

const web = new WebClient(token);
const botOptions = require('../elements/botoptions.json');
const botOptionsLoggedIn = require('../elements/botoptions_loggedin.json');
const userRewards = require('../elements/userrewards.json');
const networkSelect = require('../elements/networkselect.json');
const botAbout = require('../elements/aboutbot.json');
const getConfig = require('../src/config.js');
const nearComms = require('./nearComms');

const slackEventAdapter = createEventAdapter(slackSigningSecret);
const slackBotInteractions = createMessageAdapter(slackSigningSecret);
const nearConfig = getConfig(process.env.NEAR_ENV || 'testnet');
let targetAccountId = '';

function listenForEvents(app) {
  app.use('/events', slackEventAdapter.requestListener());
	app.use('/interactions', slackBotInteractions.requestListener());

  slackEventAdapter.on('app_mention', (event) => {
    console.log(`Received an app_mention event from user ${event.user} in channel ${event.channel}`);
    appMentionedHandler(event)
  });

	slackEventAdapter.on("reaction_added", async (event) => {
		if(event.reaction == "near_icon") {
			reactionAddedHandler(event, userLoggedIn)
		}
	});

  slackEventAdapter.on('error', (error) => {
    console.log(`error: ${error}`)
  });

	app.get('/', function (req, res) {
		res.status(404).end('N/A');
	});

	app.get('/getAccountId', function (req, res) {
		var buffer = Buffer.from(JSON.stringify({
			action: 'getAccountId',
			slackId: req.query.slackId
		}), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});

	app.get('/processAccountId/:slackId', function (req, res) {
		let slackId = req.params.slackId;
		let accountId = req.query.account_id;

		nearComms.callMethod('associate_wallet_with_slack', JSON.stringify({
			slack_account_id: slackId,
			near_account_id: accountId
		}));

		var buffer = Buffer.from(JSON.stringify({
			action: 'retainAccountId'
		}), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});

	app.get('/sendMoney', async function (req, res) {
		let targetSlackId = req.query.targetSlackId;
		let targetAccountId = req.query.targetAccountId;
		let amount = req.query.amount;
		let transactionHashes = req.query.transactionHashes;
		let errorMessage = req.query.errorMessage;

		if (transactionHashes) {
			const confirmedNearAmount = await nearComms.getDepositAmount(transactionHashes);
			if (confirmedNearAmount) {
				nearComms.callMethod('send_reward', JSON.stringify({
					slack_account_id: targetSlackId
				}), confirmedNearAmount);
				return res.end('Transaction confirmed');
			} else {
				return res.end(`Transferred amount is not confirmed. Transaction hash: ${transactionHashes}`);
			}
		} else if (errorMessage) {
			return res.end(decodeURIComponent(errorMessage));
		}

		let payLoad = { action: 'sendMoney' };
		if (targetAccountId && amount) {
			payLoad.targetAccountId = targetAccountId;
			payLoad.amount = amount;
		}
		let buffer = Buffer.from(JSON.stringify(payLoad), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});
}

async function appMentionedHandler(event) {
  try {
		let botMenu = await isLoggedIn(event.user) ? botOptionsLoggedIn : botOptions;

		await web.chat.postEphemeral({
      channel: event.channel,
			user: event.user,
      blocks: botMenu
    });
  } catch (error) {
    console.log(error);
  }
}

async function reactionAddedHandler(event) {
	try {
		if(await isLoggedIn(event.item_user)){
			userRewards[0].label.text = `How many Near tokens you would like to send to <@${event.item_user}>?`;
			targetAccountId = event.item_user;
			await web.chat.postEphemeral({
				channel: event.item.channel,
				user: event.user,
				blocks: userRewards
			});
		} else {
			await web.chat.postEphemeral({
				channel: event.item.channel,
				user: event.user,
				blocks: [
					{
						"type": "section",
						"text": {
							"type": "mrkdwn",
							"text": "It seems you are not authorized yet, in order to start working with the bot please call @Near Test App in the chat"
						}
					}
				]
			});
		}

	} catch (error) {
		console.log(error);
	}
}

slackBotInteractions.action({}, async (payload, respond) => {

	let actionId = payload.actions[0].action_id === 'near-bot-menu' ? payload.actions[0].selected_option.value : payload.actions[0].action_id;

	switch (actionId) {
		case 'login':
			respond({
				text: "Please select the network:",
				blocks: networkSelect,
				replace_original: true
			});
			break;

		case 'about':
			respond({
				text: 'Near bot about',
				blocks: botAbout,
				replace_original: true
			});
			break;

		case 'balance':
			var balance = await getBalance(payload);
			var text = `Your balance is ${utils.format.formatNearAmount(String(balance))} Near`;

			renderSlackBlock(respond, text);
			break;

		case'withdraw':
			var balance = await getBalance(payload);

			if (balance != 0) {
				nearComms.callMethod('withdraw_rewards', JSON.stringify({
					slack_account_id: payload.user.id
				}));
			} else {
				renderSlackBlock(respond, `Ooops, nothing to withdraw yet! :confused:`);
			}

			break;

		case 'network-select-main':
			var text = `Please authorize this bot in your NEAR account by <${nearConfig.endpoints.apiHost}/getAccountId?slackId=${payload.user.id}|the following link>`;
			renderSlackBlock(respond, text);

			break;

		case 'send-rewards':

			var text = `In order to send tokens please <${nearConfig.endpoints.apiHost}/sendMoney?targetSlackId=${targetAccountId}&targetAccountId=${nearConfig.contractName}&amount=${payload.actions[0].value}|follow the link>`;
			renderSlackBlock(respond, text);

			break;
	}

	return { text: 'Processing...' }
});

async function isLoggedIn(user) {
	const result = await nearComms.callMethod('get_wallet', JSON.stringify({
		slack_account_id: user
	}));
	return result.length > 0;
}

async function getBalance(payload) {
	var balance = await nearComms.callMethod('get_rewards', JSON.stringify({
		slack_account_id: payload.user.id
	}));
	return balance
}

function renderSlackBlock(respond, text) {
	respond({
		blocks: [
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": text
				}
			}
		]
		,
		replace_original: true
	});
}

module.exports.listenForEvents = listenForEvents;
module.exports.appMentionedHandler = appMentionedHandler;
