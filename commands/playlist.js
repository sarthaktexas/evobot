require('dotenv').config()
const { MessageEmbed } = require("discord.js");
const { play } = require("../include/play");
const { YOUTUBE_API_KEY, MAX_PLAYLIST_SIZE, SOUNDCLOUD_CLIENT_ID } = require("../config.json");
const YouTubeAPI = require("simple-youtube-api");
const youtube = new YouTubeAPI(process.env.YOUTUBE_API_KEY);
const scdl = require("soundcloud-downloader")
var SpotifyWebApi = require('spotify-web-api-node');
const { link } = require('ffmpeg-static');
var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: 'https://srtk.me'
});

spotifyApi.clientCredentialsGrant()
  .then(function (data) {
    spotifyApi.setAccessToken(data.body['access_token']);
  }, function (err) {
    console.log('Something went wrong when retrieving an access token', err.message);
  });

module.exports = {
  name: "playlist",
  cooldown: 3,
  aliases: ["pl"],
  description: "Play a playlist from youtube",
  async execute(message, args) {
    const { PRUNING } = require("../config.json");
    const { channel } = message.member.voice;

    const serverQueue = message.client.queue.get(message.guild.id);
    if (serverQueue && channel !== message.guild.me.voice.channel)
      return message.reply(`You must be in the same channel as ${message.client.user}`).catch(console.error);

    if (!args.length)
      return message
        .reply(`Usage: ${message.client.prefix}playlist <YouTube Playlist URL | Playlist Name>`)
        .catch(console.error);
    if (!channel) return message.reply("You need to join a voice channel first!").catch(console.error);

    const permissions = channel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT"))
      return message.reply("Cannot connect to voice channel, missing permissions");
    if (!permissions.has("SPEAK"))
      return message.reply("I cannot speak in this voice channel, make sure I have the proper permissions!");

    const search = args.join(" ");
    const pattern = /^.*(youtu.be\/|list=)([^#\&\?]*).*/gi;
    const url = args[0];
    const urlValid = pattern.test(args[0]);

    const queueConstruct = {
      textChannel: message.channel,
      channel,
      connection: null,
      songs: [],
      loop: false,
      volume: 100,
      playing: true
    };

    let song = null;
    let spotifyAlbumId = null;
    let spotifyPlaylistId = null;
    let playlist = null;
    let videos = [];

    if (urlValid) {
      try {
        playlist = await youtube.getPlaylist(url, {
          part: "snippet"
        });
        videos = await playlist.getVideos(MAX_PLAYLIST_SIZE || 10, {
          part: "snippet"
        });
      } catch (error) {
        console.error(error);
        return message.reply("Playlist not found :(").catch(console.error);
      }
    } else if (scdl.isValidUrl(args[0])) {
      if (args[0].includes('/sets/')) {
        message.channel.send('⌛ fetching the playlist...')
        playlist = await scdl.getSetInfo(args[0], SOUNDCLOUD_CLIENT_ID)
        videos = playlist.tracks.map(track => ({
          title: track.title,
          url: track.permalink_url,
          duration: track.duration / 1000
        }))
      }
    } else if (url.includes("https://open.spotify.com/album") || url.includes("https://open.spotify.com/playlist")) {
      try {
        spotifyApi.clientCredentialsGrant()
          .then(function (data) {
            spotifyApi.setAccessToken(data.body['access_token']);
          }, function (err) {
            console.log('Something went wrong when retrieving an access token', err.message);
          });
        if (url.includes('/album/')) {
          message.channel.send('⌛ fetching the album...');
          let spotifyAlbumRegex = RegExp(/https:\/\/open.spotify.com\/album\/(.+)\?(.+)/gi);
          spotifyAlbumId = spotifyAlbumRegex.exec(url)[1];
          playlist = await spotifyApi.getAlbum(spotifyAlbumId);
          let youtubeFetchError;
          playlist.body.tracks.items.forEach(track => {
            youtube.searchVideos(`${track.name} ${track.artists[0].name}`, 1).then(data => {
              let url = `https://youtube.com/watch?v=${data[0].id}`;
              videos.push({
                title: track.name,
                url: url,
                duration: track.duration_ms / 1000
              });
            }).catch(err => youtubeFetchError = err);
          });
          if (youtubeFetchError) {
            message.channel.send('Couldn\'t fetch Youtube videos because Error `' + youtubeFetchError.code + ': ' + youtubeFetchError.errors[0].reason);
          }
        } else if (url.includes('/playlist/')) {
          message.channel.send('⌛ fetching the playlist...');
          let spotifyPlaylistRegex = RegExp(/https:\/\/open.spotify.com\/playlist\/(.+)\?(.+)/gi);
          spotifyPlaylistId = spotifyPlaylistRegex.exec(url)[1];
          playlist = await spotifyApi.getPlaylist(spotifyPlaylistId);
          let youtubeFetchError;
          playlist.body.tracks.items.forEach(track => {
            youtube.searchVideos(`${track.track.name} ${track.track.artists[0].name}`, 1).then(link => {
              let url = `https://youtube.com/watch?v=${data[0].id}`;
              videos.push({
                title: track.track.name,
                url: url,
                duration: track.track.duration_ms / 1000
              });
            }).catch(err => youtubeFetchError = err);
          });
          if (youtubeFetchError) {
            console.log(youtubeFetchError);
            message.channel.send('Couldn\'t fetch Youtube videos because Error `' + youtubeFetchError.code + ': ' + youtubeFetchError.errors[0].reason);
          }
        }
      } catch (error) {
        console.error(error);
        return message.reply("I can't find a playlist or album with that link.").catch(console.error);
      }
    } else {
      try {
        const results = await youtube.searchPlaylists(search, 1, {
          part: "snippet"
        });
        playlist = results[0];
        videos = await playlist.getVideos(MAX_PLAYLIST_SIZE || 10, {
          part: "snippet"
        });
      } catch (error) {
        console.error(error);
        return message.reply("Playlist not found :(").catch(console.error);
      }
    }

    videos.forEach((video) => {
      song = {
        title: video.title,
        url: video.url,
        duration: video.durationSeconds
      };
      if (serverQueue) {
        serverQueue.songs.push(song);
        if (!PRUNING)
          message.channel
          .send(`✅ **${song.title}** has been added to the queue by ${message.author}`)
          .catch(console.error);
      } else {
        queueConstruct.songs.push(song);
      }
    });

    let playlistEmbed;

    /**
     * Capitalize first letter in string.
     */
    String.prototype.capitalize = function() {
      return this.charAt(0).toUpperCase() + this.slice(1)
    }

    if (spotifyAlbumId) {
      playlistEmbed = new MessageEmbed()
      .setTitle(playlist.body.name)
      .setURL(playlist.body.href)
      .setDescription(`${playlist.body.artists[0].name} • ${playlist.body.album_type.capitalize()} • ${playlist.body.release_date.substring(0, 4)} • ${playlist.body.total_tracks} songs.`)
      .setThumbnail(playlist.body.images[0].url)
      .setColor("#F8AA2A")
      .setTimestamp();
    } else if (spotifyPlaylistId) {
      playlistEmbed = new MessageEmbed()
      .setTitle(playlist.body.name)
      .setURL(playlist.body.href)
      .setDescription(playlist.body.description)
      .setThumbnail(playlist.body.images[0].url)
      .setColor("#F8AA2A")
      .setTimestamp();
    } else {
      playlistEmbed = new MessageEmbed()
      .setTitle(`${playlist.title}`)
      .setURL(playlist.url)
      .setColor("#F8AA2A")
      .setTimestamp();
    }

    if (!PRUNING) {
      playlistEmbed.setDescription(queueConstruct.songs.map((song, index) => `${index + 1}. ${song.title}`));
      if (playlistEmbed.description.length >= 2048)
        playlistEmbed.description =
        playlistEmbed.description.substr(0, 2007) + "\nPlaylist larger than character limit...";
    }

    message.channel.send(`${message.author} Started a playlist`, playlistEmbed);

    if (!serverQueue) message.client.queue.set(message.guild.id, queueConstruct);

    if (!serverQueue) {
      try {
        queueConstruct.connection = await channel.join();
        await queueConstruct.connection.voice.setSelfDeaf(true);
        play(queueConstruct.songs[0], message);
      } catch (error) {
        console.error(error);
        message.client.queue.delete(message.guild.id);
        await channel.leave();
        return message.channel.send(`Could not join the channel: ${error}`).catch(console.error);
      }
    }
  }
};