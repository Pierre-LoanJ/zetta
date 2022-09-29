const express = require('express');
const {graphqlHTTP} = require('express-graphql');
const {buildSchema} = require('graphql');
const fetch = require('node-fetch');

const EMOTICON_PATTERN = /\B\([a-z0-9]+/gi;
const MENTION_PATTERN = /\B@[a-z0-9]+/gi;
const URL_PATTERN = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

const schema = buildSchema(`
  type Link {
    url: String
    title: String
  }
  type Record {
    mentions: [String]
    emoticons: [String]
    links: [Link]
  }

  type Query {
    echo(message: String): String
  }

  type Mutation {
    records(message: String): Record
  }
`);

class Record {
    mentions = [];
    emoticons = [];
    links = [];

    constructor(mentions, emoticons, links) {
        this.mentions = mentions;
        this.emoticons = emoticons;
        this.links = links;
    }
}

function getEmoticons(message) {
    let emoticons = message.match(EMOTICON_PATTERN);
    return emoticons.map((emoticon) => emoticon.substring(1)) // get rid of '('
}

function getMentions(message) {
    let mentions = message.match(MENTION_PATTERN);
    return mentions.map((mention) => mention.substring(1)) // get rid of '@'
}

async function setLinks(record, message) {
    record.links = [];
    let links = message.match(URL_PATTERN);

    await Promise.all(links.map(async (link) => {
        const response = await fetch(link);
        const page = await response.text();
        const titlePattern = /<title[^>]*>(.*?)<\/title>/;
        const matches = page.match(titlePattern);
        const title = matches[1];
        record.links.push({title: title, url: link});
    }));
}

const root = {
    echo: ({message}) => {
        return message
    },
    records: async ({message}) => {
        let record = new Record();
        record.mentions = getMentions(message)
        record.emoticons = getEmoticons(message)
        await setLinks(record, message);
        return record;
    }
};

const app = express();
app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));
app.listen(4000);
console.log("Server is running and available at http://localhost:4000")
