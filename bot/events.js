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
const nomination_new = require('../elements/nomination_new.json');
const nomination_menu = require('../elements/nominations_menu.json');
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
		let transactionHashes = req.query.transactions;
		let errorMessage = req.query.errorMessage;
		if (transactionHashes) {
			let payLoad = {
				action: 'showTransactionConfirmation',
				nearConfig: nearConfigFE
			};
			let buffer = Buffer.from(JSON.stringify(payLoad), 'utf-8');
			res.render ('index', {locals: {
				context: buffer.toString('base64') }
			});
		} else if (errorMessage) {
			return res.end(decodeURIComponent(errorMessage));
		}

		let buffer = Buffer.from(JSON.stringify({
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

	app.get('/createNomination/:ownerSlackId/:nominationTitle/:depositAmount', function (req, res) {
		let transactionHashes = req.query.transactionHashes;
		let errorMessage = req.query.errorMessage;
		if (transactionHashes) {
			let payLoad = {
				action: 'showTransactionConfirmation',
				nearConfig: nearConfigFE
			};
			let buffer = Buffer.from(JSON.stringify(payLoad), 'utf-8');
			res.render ('index', {locals: {
				context: buffer.toString('base64') }
			});
		} else if (errorMessage) {
			return res.end(decodeURIComponent(errorMessage));
		}

		var buffer = Buffer.from(JSON.stringify({
			action: 'createNomination',
			ownerSlackId: req.params.ownerSlackId,
			nominationTitle: req.params.nominationTitle,
			depositAmount: req.params.depositAmount,
			methodName: 'create_nomination',
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
      blocks: botMenu,
    });
  } catch (error) {
    console.log(error);
  }
}

async function reactionAddedHandler(event) {
	try {
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

		case 'nomination-menu':
			channelId = payload.channel.id;

			let result;
			let isValid;
			let title = '';
			let userTable = [];
			let nominationAmount = 0;
			try {
				const rawResult = await nearComms.callMethod('get_nomination', JSON.stringify({owner: payload.user.id}));
				console.log("rawResult", rawResult);
				result = JSON.parse(rawResult.replace(/(.*?amount.\:)(\d+)(.*)/, '$1"$2"$3'));

				isValid = result.is_valid;
				title = result.title;
				userTable = (result.nominators || []).sort((a, b) => a.votes - b.votes);
			} catch (error) {
				result = {error: true};
			}
			if (!result.error) {

				nominationAmount = utils.format.formatNearAmount(String(result.amount));
				await renderNominationMenu(title, userTable, nominationAmount, respond, isValid);
			}

			break;

		case 'nomination-new':

			return web.views.open({
			 token: token,
			 trigger_id: payload.trigger_id,
			 view: nomination_new
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

		case 'nomination-vote-action':
			console.log("nomination-vote-action", payload);

			var text = `In order to vote for this user please <${nearConfig.endpoints.apiHost}/voteForSlackId/${payload.user.id}/${payload.actions[0].selected_conversation}|follow the link>`;
			renderSlackBlock(respond, text);
			break;

		case 'nomination-finish':
			console.log("nomination-finish");
			await nearComms.callMethod('finish_nomination', JSON.stringify({owner: payload.user.id}));
			break;
	}

	return { text: 'Processing...' }
});

slackBotInteractions.viewSubmission('nomination_modal_submission', async (payload) => {
	try {
		var userId = payload.user.id;
		var nominationTitle = payload.view.state.values["nomination-new-name"].nomination_new_name.value;
		var depositAmount = payload.view.state.values["nomination-new-amount"].nomination_amount.value;
		var text = `In order to confirm nomination creation please <${nearConfig.endpoints.apiHost}/createNomination/${userId}/${nominationTitle}/${depositAmount}|follow the link>`;

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

	try {
		var members = await web.conversations.members({
			token: token,
			channel: channelId
		});

		for (var member of members.members) {
			await web.chat.postMessage({
				channel: member,
				user: member,
				blocks: [
					{
						"type": "section",
						"text": {
							"type": "mrkdwn",
							"text": `Dear <@${member}> Please vote for the nomination 'Engineer of the month'`
						}
					},
					{
						"type": "actions",
						"elements": [
							{
								"type": "conversations_select",
								"placeholder": {
									"type": "plain_text",
									"text": "Select a user",
									"emoji": true
								},
								"action_id": "nomination-vote-action",
								"filter": {
									"include": [
										"im"
									],
									"exclude_bot_users": true
								}
							}
						]
					}
				]
			});
		}
	}
	catch (error) {
		console.error(error);
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

function renderNominationMenu(title, userTable, nominationAmount, respond, isValid) {

		var nomination_item = {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `*_${title} _*`
			},
			"accessory": {
				"type": "button",
				"text": {
					"type": "plain_text",
					"text": "Finish",
					"emoji": true
				},
				"action_id": "nomination-finish"
			}
		};

	var no_nominations = {
		"type": "context",
		"elements": [
			{
				"type": "plain_text",
				"text": "No active nominations :man-shrugging:",
				"emoji": true
			}]
	}

	var divider = {
		"type": "divider"
	};

	const nomination_menu_render = nomination_menu.slice();
	nomination_item = isValid ? nomination_item : no_nominations;
	nomination_menu_render.push(nomination_item);

	if(userTable.length){
		for(var i = 0; i < userTable.length; i++) {
			nomination_menu_render.push({
				"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": `<@${userTable[i].slack_user}> - ${userTable[i].votes} votes`//${userTable[i].votes}
					}
				}
			);
		}
	} else if (isValid) {
		nomination_menu_render.push({
			"type": "context",
			"elements": [
			{
				"type": "plain_text",
				"text": "No votes yet :yawning_face:",
				"emoji": true
			}]
		});
	}


	nomination_menu_render.push(divider);

	respond({
		text: '',
		blocks: nomination_menu_render,
		replace_original: true
	});
}

module.exports.listenForEvents = listenForEvents;
module.exports.appMentionedHandler = appMentionedHandler;
