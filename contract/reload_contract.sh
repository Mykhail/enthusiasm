#!/bin/bash

blue_color='\033[0;34m'
clear_color='\033[0m'
near_acc=${1}
parent_near_acc=${2}

if [ -z "${near_acc}" ]; then
    echo "please specify near sub account"
    exit 1;
fi

if [ -z "${parent_near_acc}" ]; then
    echo "please specify near parent account"
    exit 1;
fi

echo -e "${blue_color}Building binary${clear_color}"
./build.sh

echo -e "${blue_color}Deleting old account${clear_color}"
near delete $near_acc $parent_near_acc

echo -e "${blue_color}Creating new account${clear_color}"
near create-account $near_acc --masterAccount $parent_near_acc

echo -e "${blue_color}Deploy binary${clear_color}"
near deploy --accountId $near_acc --wasmFile res/slack_bot.wasm \
    --initFunction 'new' \
    --initArgs '{"master_account_id": "sergey_shpota.testnet"}'