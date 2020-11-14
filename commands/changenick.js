module.exports = {
    name: "changenick",
    description: "Change your nickname.",
    execute(message, args) {
        if (!message.guild.me.hasPermission('MANAGE_NICKNAMES')) return message.channel.send('I don\'t have permission to change your nickname!');
        message.content.length ? return message.member.setNickname(args[0]) : message.member.setNickname();
        message.delete();
    }
};
