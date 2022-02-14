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
const nomination = require('../elements/nominations.json');
const botAbout = require('../elements/aboutbot.json');
const config = require('./config.js');
const nearComms = require('./nearComms');

const slackEventAdapter = createEventAdapter(slackSigningSecret);
const slackBotInteractions = createMessageAdapter(slackSigningSecret);
const nearConfig = config.getConfig(process.env.NEAR_ENV || 'testnet');
const nearConfigFE = config.getFrontEndConfig(process.env.NEAR_ENV || 'testnet');
let targetAccountId = '';
let channelId = '';

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

	// voting on behalf of "team member" (wallet holder signs transaction)
	app.get('/voteForSlackId/:ownerSlackId/:votedForSlackId', function (req, res) {
		var buffer = Buffer.from(JSON.stringify({
			action: 'voteForSlackId',
			ownerSlackId: req.params.ownerSlackId,
			votedForSlackId: req.params.votedForSlackId,
			methodName: 'add_vote',
			nearConfig: nearConfigFE
		}), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});

	app.get('/getAccountId/:slackId', function (req, res) {
		var buffer = Buffer.from(JSON.stringify({
			action: 'getAccountId',
			slackId: req.params.slackId,
			nearConfig: nearConfigFE
		}), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});

	app.get('/signInFailure', function (req, res) {
		res.end(`signInFailure`);
	});

	app.get('/processAccountId/:slackId', function (req, res) {
		let slackId = req.params.slackId;
		let accountId = req.query.account_id;

		nearComms.callMethod('associate_wallet_with_slack', JSON.stringify({
			slack_account_id: slackId,
			near_account_id: accountId
		}));

		var buffer = Buffer.from(JSON.stringify({
			action: 'processAccountId',
			nearConfig: nearConfigFE
		}), 'utf-8');
		res.render ('index', {locals: {
			context: buffer.toString('base64') }
		});
	});

	app.get('/sendMoney/:targetSlackId/:targetAccountId/:amount', async function (req, res) {
		let targetSlackId = req.params.targetSlackId;
		let targetAccountId = req.params.targetAccountId;
		let amount = req.params.amount;
		let transactionHashes = req.query.transactionHashes;
		let errorMessage = req.query.errorMessage;

		if (transactionHashes) {
			const confirmedNearAmount = await nearComms.getDepositAmount(transactionHashes);
			if (confirmedNearAmount) {
				nearComms.callMethod('send_reward', JSON.stringify({
					slack_account_id: targetSlackId
				}), confirmedNearAmount);
				
				let payLoad = {
					action: 'showTransactionConfirmation',
					nearConfig: nearConfigFE
				};
				let buffer = Buffer.from(JSON.stringify(payLoad), 'utf-8');
				res.render ('index', {locals: {
					context: buffer.toString('base64') }
				});
			} else {
				return res.end(`Transferred amount is not confirmed. Transaction hash: ${transactionHashes}`);
			}
		} else if (errorMessage) {
			return res.end(decodeURIComponent(errorMessage));
		}

		let payLoad = {
			action: 'sendMoney',
			nearConfig: nearConfigFE
		};
		if (targetAccountId && amount) {
			payLoad.targetSlackId = targetSlackId;
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
		console.log("event.item_use", event.user);

		console.log("await isLoggedIn(event.item_user)", await isLoggedIn(event.user));

		if(await isLoggedIn(event.user)){
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
							"text": "It seems you are not authorized yet, to start working with Enthusiasm please call @enthusiasm in the chat"
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

		case 'nomination':
			console.log("payload 12312312", payload);
			channelId = payload.channel.id;
			return web.views.open({
				token: token,
				trigger_id: payload.trigger_id,
				view: nomination
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
				await nearComms.callMethod('withdraw_rewards', JSON.stringify({
					slack_account_id: payload.user.id
				}));

				//TODO: console.log("sync call");

			} else {
				renderSlackBlock(respond, `Ooops, nothing to withdraw yet! :confused:`);
			}

			break;

		case 'network-select-main':
			var text = `Please authorize this bot in your NEAR account by <${nearConfig.endpoints.apiHost}/getAccountId/${payload.user.id}|the following link>`;
			renderSlackBlock(respond, text);

			break;

		case 'send-rewards':

			var text = `In order to send tokens please <${nearConfig.endpoints.apiHost}/sendMoney/${targetAccountId}/${nearConfig.contractName}/${payload.actions[0].value}|follow the link>`;
			renderSlackBlock(respond, text);

			break;
	}

	return { text: 'Processing...' }
});

slackBotInteractions.action({ type: 'view_submission' }, (payload, respond) => {
	console.log("view_submission", payload, respond);
});

slackBotInteractions.viewSubmission('nomination_modal_submission', (payload, respond) => {
	var text = `In order to send tokens please <${nearConfig.endpoints.apiHost}/sendMoney/}|follow the link>`;
	try {
		web.chat.postEphemeral({
			channel: channelId,
			user: payload.user.id,
			blocks: [
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": text
				}
			}
		]
		});
	} catch (error) {
		console.log(error);
	}
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
