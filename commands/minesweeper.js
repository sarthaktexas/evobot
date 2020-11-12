const Minesweeper = require('discord.js-minesweeper');

module.exports = {
  name: "minesweeper",
  description: "Spawn a minesweeper game.",
  execute(message, args) {
    if (!args.length) {
      message.reply(`Usage: ${message.client.prefix}minesweeper <mines> <emote>`)
        .catch(console.error);
    } else {
      let emote = args[1] ? args[1] : 'boom'
        const minesweeper = new Minesweeper({
          mines: args[0],
          emote: emote,
        });
      message.channel.send(minesweeper.start());
      message.channel.send(`*${args[0]} mines. :${emote}: is the bomb. <@${message.author.id}> spawned this game.*`)
      message.delete();
    }
  }
};