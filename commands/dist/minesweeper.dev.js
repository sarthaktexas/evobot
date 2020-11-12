"use strict";

var Minesweeper = require('discord.js-minesweeper');

module.exports = {
  name: "minesweeper",
  description: "Spawn a minesweeper game.",
  execute: function execute(message, args) {
    if (!args.length) {
      message.reply("Usage: ".concat(message.client.prefix, "minesweeper <mines> <emote>"))["catch"](console.error);
    } else {
      var emote = args[1] ? args[1] : 'boom';
      var minesweeper = new Minesweeper({
        mines: args[0],
        emote: emote
      });
      message.channel.send(minesweeper.start());
      message.channel.send("*".concat(args[0], " mines. :").concat(emote, ": is the bomb. <@").concat(message.author.id, "> spawned this game.*"));
      message["delete"]();
    }
  }
};