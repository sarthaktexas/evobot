"use strict";

module.exports = {
  name: "stnick",
  description: "Change someone elses nickname.",
  execute: function execute(message, args) {
    if (!message.guild.me.hasPermission('MANAGE_NICKNAMES')) return message.channel.send('I don\'t have permission to change nicknames!');
    var nickname = args.splice(1).toString().replace(/,/g, ' ');
    message.guild.member(message.mentions.users.first().id).setNickname(nickname ? nickname : '');
    message["delete"]();
  }
};