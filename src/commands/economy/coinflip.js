const { EmbedBuilder } = require('discord.js');
const Schema = require('../../database/models/economy');

async function getBalance(userId) {
    const data = await Schema.findOne({ User: userId }).lean().exec();
    return data?.Money ?? 0;
}

async function changeBalance(userId, amount) {
    return Schema.findOneAndUpdate(
        { User: userId },
        { $inc: { Money: amount }, $setOnInsert: { Bank: 0 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
}

module.exports = {
    name: 'coinflip',
    aliases: ['cf'],
    description: 'Bet coins on a coinflip (virtual currency only)',
    async execute(client, message, args) {
        const amount = parseInt(args[0], 10);
        const choice = (args[1] || '').toLowerCase();

        if (!amount || amount <= 0) return message.reply('Usage: `.coinflip <amount> <heads/tails>`');
        if (!['heads', 'tails'].includes(choice)) return message.reply('Pick `heads` or `tails`.');

        const balance = await getBalance(message.author.id);
        if (balance < amount) return message.reply("You don't have enough cash for that bet.");

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === choice;

        await changeBalance(message.author.id, won ? amount : -amount);

        const embed = new EmbedBuilder()
            .setColor(won ? '#57F287' : '#ED4245')
            .setDescription(
                `🪙 The coin landed on **${result}**!\n` +
                (won
                    ? `You won **${amount.toLocaleString()}** coins!`
                    : `You lost **${amount.toLocaleString()}** coins.`)
            );

        message.reply({ embeds: [embed] });
    }
};
