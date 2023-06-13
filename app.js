const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const path = require("path");
const jwt = require("jsonwebtoken");
app.use(express.json());
const sqlite3 = require("sqlite3");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializationDatabase = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error at '${error.message}'`);
    process.exit(1);
  }
};
initializationDatabase();

const GetFollowingPeopleIds = async (username) => {
  const getTheFollowingPeopleQuery = `
  SELECT 
  following_user_id FROM follower 
  INNER JOIN user ON user.user_id = follower.follower_user_id
  WHERE user.username='${username}';`;

  const followingPeople = await db.all(getTheFollowingPeopleQuery);
  const arrayOfIds = followingPeople.map(
    (eachUser) => eachUser.following_user_id
  );
  return arrayOfIds;
};

// Authentication Token Middle Ware Function
const authentication = (request, response, next) => {
  const { tweet } = request.body;
  const { tweetId } = request.params;
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "KALYAN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        request.tweetId = tweetId;
        request.tweet = tweet;
        next();
      }
    });
  }
};

const tweetAccessVerification = async (request, response, next) => {
  const { userId } = request;
  const { tweetId } = request.params;
  const getTweetQuery = `
  SELECT
  *
  FROM tweet INNER JOIN follower
  ON tweet.user_id = follower.following_user_id
  WHERE tweet.tweet_id = '${tweetId}' AND follower_user_id = '${userId}';`;

  const tweet = await db.get(getTweetQuery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};

//API 1 New User
app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const GetOldUser = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username, password, name, gender);
  const GetUser = await db.get(GetOldUser);
  if (GetUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const PostNewUser = `
      INSERT INTO 
        user (name,username,password,gender)
      VALUES (
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
          );
        `;
      await db.run(PostNewUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2 Login user
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const GetUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  console.log(username, password);
  const GetUser = await db.get(GetUserQuery);
  console.log(GetUser);
  if (GetUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, GetUser.password);
    if (isPasswordMatch === true) {
      const jwtToken = jwt.sign(GetUser, "KALYAN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  //const followingPeopleIds = await GetFollowingPeopleIds(username);

  const GetFeedsSQLQuery = `
  SELECT 
    username,
    tweet,
    date_time AS dateTime
  FROM 
    follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN user ON user.user_id = follower.following_user_id
  WHERE
    follower.follower_user_id = ${user_id}
  ORDER BY 
    date_time DESC
  LIMIT 4
    ;`;
  const tweets = await db.all(GetFeedsSQLQuery);
  response.send(tweets);
});

//API 4
app.get("/user/following", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);
  const GetUserFollowingList = `
        SELECT
            name 
        FROM
            user INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE
            follower.follower_user_id =${user_id} 
        ;`;

  const ListOfFollowers = await db.all(GetUserFollowingList);
  response.send(ListOfFollowers);
});

//API 5
app.get("/user/followers", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name);

  const GetUserFollowingList = `
        SELECT 
            name 
        FROM 
            user INNER JOIN follower ON user.user_id = follower.follower_user_id
        WHERE 
            follower.following_user_id = ${user_id} 
    ;`;
  const followers = await db.all(GetUserFollowingList);
  response.send(followers);
});

//API 6
app.get("/tweets/:tweetId", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, tweetId);

  const tweetQuey = `SELECT * FROM tweet WHERE tweet_id =${tweetId};`;
  const tweetResult = await db.get(tweetQuey);

  const userFollowsQuery = `
        SELECT
        *
        FROM follower INNER JOIN user ON user.user_id = follower.following_user_id
        WHERE
            follower.follower_user_id =${user_id}
        ;`;
  const userFollowers = await db.all(userFollowsQuery);
  if (
    userFollowers.some((item) => item.following_user_id === tweetResult.user_id)
  ) {
    console.log(tweetResult);
    console.log("............");
    console.log(userFollowers);
    const GetTweetsSQLQuery = `
            SELECT
                tweet,
                COUNT(DISTINCT(like.like_id)) AS likes,
                COUNT(DISTINCT(reply.reply_id)) AS replies,
                tweet.date_time AS dateTime 
            FROM 
                tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id 
            WHERE
                tweet.tweet_id = ${tweetId} AND tweet.user_id=${userFollowers[0].user_id}
            ;`;
    const tweet = await db.get(GetTweetsSQLQuery);
    response.send(tweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  tweetAccessVerification,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const GetLikesUserQuery = `
            SELECT 
                *
            FROM 
                follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id
            WHERE
            tweet.tweet_id = '${tweetId}' AND follower.follower_user_id = '${user_id}'
    ;`;
    const LikedUsers = await db.all(GetLikesUserQuery);
    console.log(LikedUsers);
    if (LikedUsers.length !== 0) {
      let likes = [];
      const getNamesArray = (LikedUsers) => {
        for (let item of LikedUsers) {
          likes.push(item.username);
        }
      };
      getNamesArray(LikedUsers);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8
app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request;
    const { payload } = request;
    const { user_id, name, username, gender } = payload;
    console.log(name, tweetId);
    const GetRepliesQuery = `
            SELECT
                *
            FROM 
                follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
                INNER JOIN user ON user.user_id = reply.user_id
            WHERE
                tweet.tweet_id = '${tweetId}' AND follower.follower_user_id = '${user_id}'
        ;`;
    const repliesUsers = await db.all(GetLikesUserQuery);
    console.log(repliesUsers);
    if (repliesUsers.length !== 0) {
      let replies = [];
      const getNamesArray = (repliesUsers) => {
        for (let item of repliesUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliesUsers);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9
app.get("/user/tweets", authentication, async (request, response) => {
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  console.log(name, user_id);

  const GetUserTweetQuery = `
        SELECT 
            tweet.tweet AS tweet,
            COUNT(DISTINCT(like.like_id)) AS likes,
            COUNT(DISTINCT(reply.reply_id)) AS replies,
            tweet.date_time AS dateTime 
        FROM 
            user INNER JOIN tweet ON user.user_id = tweet.user_id INNER JOIN like ON like.tweet_id = tweet.tweet_id INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE 
            user.user_id = ${user_id} 
        GROUP BY 
            tweet.tweet_id
        ;`;
  const TweetUsers = await db.all(GetUserTweetQuery);
  response.send(TweetUsers);
});
//API 10
app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const userId = parseInt(request.userId);
  const dateTime = new Date().toJSON().substring(0, 19).replace("T", " ");

  const CreateTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}','${userId};','${dateTime}')`;

  await db.run(CreateTweetQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete("/tweets/:tweetId", authentication, async (request, response) => {
  const { tweetId } = request;
  const { payload } = request;
  const { user_id, name, username, gender } = payload;
  const selectUserQuery = `SELECT * FROM tweet WHERE tweet.user_id = ${user_id} AND tweet.tweet_id = ${tweetId};`;
  const tweet = await db.all(selectUserQuery);
  console.log(tweet);
  if (tweet.length !== 0) {
    const deleteQuery = `
    DELETE FROM tweet 
    WHERE 
        tweet.user_id = ${user_id} AND tweet.tweet_id =${tweetId}
    ;`;
    await db.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//export Module
module.exports = app;
