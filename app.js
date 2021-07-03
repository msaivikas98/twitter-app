const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let database = null;
const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at port: 3000");
    });
  } catch (error) {
    console.log(`Db Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

// API 1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const selectUserQuery = `SELECT *
     FROM user
     WHERE username='${username}';`;

  const dbQuery = await database.get(selectUserQuery);

  if (dbQuery !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const insertUserQuery = `INSERT INTO user (name,username,password,gender)
       VALUES ('${name}','${username}','${hashedPassword}','${gender}');`;

      const dbAddUser = await database.run(insertUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUserQuery = `SELECT *
    FROM user
    WHERE username ='${username}';`;

  const dbGetUser = await database.get(getUserQuery);

  if (dbGetUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbGetUser.password
    );

    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authenticate Token
function authenticateToken(request, response, next) {
  const authHeader = request.headers["authorization"];
  console.log(request.body);
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.body = {
          payloadUserName: payload.username,
        };
        next();
      }
    });
  }
}
// Authenticate Token1
function authenticateToken1(request, response, next) {
  const authHeader = request.headers["authorization"];
  console.log(request.body);
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        const { tweet } = request.body;
        request.body = {
          payloadUserName: payload.username,
          tweet: tweet,
        };
        next();
      }
    });
  }
}
const convertDbObjectToJsonObject = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};

// API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);

  const selectQuery = `SELECT user.username as username,tweet.tweet as tweet,tweet.date_time as dateTime
  FROM (follower inner join tweet on 
    follower.following_user_id=tweet.user_id) as t inner join user on
    t.following_user_id=user.user_id
  WHERE follower.follower_user_id=${userId}
  ORDER BY tweet.date_time DESC;`;

  const dbFollowingUserIds = await database.all(selectQuery);
  response.send(dbFollowingUserIds);
});

// API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);

  const selectNamesQuery = `SELECT user.name
  FROM follower inner join user on follower.following_user_id=user.user_id where follower.follower_user_id=${userId};`;

  const dbNames = await database.all(selectNamesQuery);
  response.send(dbNames);
});

// API 5
app.get("/user/followers", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);

  const selectFollowersNames = `select user.name 
  from user inner join follower on 
       user.user_id=follower.follower_user_id 
  where follower.following_user_id=${userId};`;

  const dbFollowerNames = await database.all(selectFollowersNames);
  response.send(dbFollowerNames);
});

// API 6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);

  const { tweetId } = request.params;

  const checkQuery = `select * 
  from follower inner join tweet 
     on follower.following_user_id=tweet.user_id 
  where follower.follower_user_id=${userId} and tweet.tweet_id=${tweetId};`;

  const dbCheck = await database.all(checkQuery);
  console.log(dbCheck);
  if (dbCheck.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const selectTweetReplyQuery = `select count() as repliesCount
      from tweet inner join reply on tweet.tweet_id=reply.tweet_id
      where tweet.tweet_id=${tweetId};`;

    const dbReply = await database.get(selectTweetReplyQuery);

    const repliesCount = dbReply.repliesCount;

    const selectTweetLikeQuery = `select count() as likesCount
      from tweet inner join like on tweet.tweet_id=like.tweet_id
      where tweet.tweet_id=${tweetId};`;

    const dbLike = await database.get(selectTweetLikeQuery);

    const likesCount = dbLike.likesCount;

    const select = `select tweet.tweet, tweet.date_time
      from tweet 
      where tweet.tweet_id=${tweetId};`;

    const dbTweet = await database.get(select);
    const tweet1 = dbTweet.tweet;
    const date_time1 = dbTweet.date_time;

    response.send({
      tweet: tweet1,
      likes: likesCount,
      replies: repliesCount,
      dateTime: date_time1,
    });
  }
});

// API 7
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { payloadUserName } = request.body;

    console.log(payloadUserName);
    const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

    const dbUserId = await database.get(selectUserIdQuery);
    console.log(dbUserId);

    const userId = dbUserId.user_id;
    console.log(userId);

    const { tweetId } = request.params;

    const checkQuery = `select * 
  from follower inner join tweet 
     on follower.following_user_id=tweet.user_id 
  where follower.follower_user_id=${userId} and tweet.tweet_id=${tweetId};`;

    const dbCheck = await database.all(checkQuery);
    console.log(dbCheck);
    if (dbCheck.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const selectQuery = `select user.username
        from like inner join user on like.user_id=user.user_id 
        where like.tweet_id=${tweetId};`;

      const dbSelect = await database.all(selectQuery);
      console.log(dbSelect);

      let namesList = [];
      for (let each of dbSelect) {
        namesList.push(each.username);
      }
      console.log(namesList);

      response.send({
        likes: namesList,
      });
    }
  }
);

/// API 8
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { payloadUserName } = request.body;

    console.log(payloadUserName);
    const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

    const dbUserId = await database.get(selectUserIdQuery);
    console.log(dbUserId);

    const userId = dbUserId.user_id;
    console.log(userId);

    const { tweetId } = request.params;

    const checkQuery = `select * 
  from follower inner join tweet 
     on follower.following_user_id=tweet.user_id 
  where follower.follower_user_id=${userId} and tweet.tweet_id=${tweetId};`;

    const dbCheck = await database.all(checkQuery);
    console.log(dbCheck);
    if (dbCheck.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const selectQuery = `select user.name,reply.reply
        from reply inner join user on reply.user_id=user.user_id
        where reply.tweet_id=${tweetId};`;

      const dbSelect = await database.all(selectQuery);
      console.log(dbSelect);
      response.send({
        replies: dbSelect,
      });
    }
  }
);

// API 9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);

  const selectQuery = `select t.tweet,count() as likes,replies,t.dateTime  from (select tweet.tweet_id as tid,tweet.tweet as tweet, count() as replies,tweet.date_time as dateTime from tweet left join reply on tweet.tweet_id =reply.tweet_id where tweet.user_id=${userId} group by tweet.tweet_id) as t inner join like on t.tid =like.tweet_id group by t.tid;`;

  const dbTweets = await database.all(selectQuery);
  response.send(dbTweets);
});

// API 10
app.post("/user/tweets/", authenticateToken1, async (request, response) => {
  const { payloadUserName } = request.body;

  console.log(payloadUserName);
  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);
  console.log(dbUserId);

  const userId = dbUserId.user_id;
  console.log(userId);
  let date = new Date();
  console.log(date);

  const { tweet } = request.body;
  console.log(request.body);
  console.log(tweet);
  const postQuery = `INSERT INTO tweet (tweet,user_id,date_time)
  VALUES ('${tweet}','${userId}','${date}')`;

  await database.run(postQuery);
  response.send("Created a Tweet");
});

// API 11
app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { payloadUserName } = request.body;

  const selectUserIdQuery = `SELECT user_id
  FROM user
  WHERE username='${payloadUserName}';`;

  const dbUserId = await database.get(selectUserIdQuery);

  const userId = dbUserId.user_id;

  const { tweetId } = request.params;

  const checkQuery = `SELECT *
   FROM tweet
   WHERE tweet_id=${tweetId} and user_id=${userId}`;

  const dbCheck = await database.get(checkQuery);

  if (dbCheck === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `DELETE FROM tweet
      WHERE tweet_id=${tweetId};`;

    await database.run(deleteQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
