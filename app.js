const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express(); // creating a server instance
app.use(express.json());

const dbPath = path.join(__dirname, "addStory.db");
let database = null;

// function to start the server
const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server started at port: 3000");
      deleteRowsInitially();
    });
  } catch (error) {
    console.log(`Db Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

/* when the project starts the changes made to the database earlier will be lost 
to enter new stories every time after executing the project */
const deleteRowsInitially = async () => {
  const deleteQuery = `delete from story;`;
  await database.run(deleteQuery);
};

// defining variables
let wordsCount = 0;
let title = "";
let storyId = 1;
let paragraphsCount = 0;
let sentencesCount = 0;
let currentSentence = "";
let sentenceLength = 0;
let paragraphsList = [{ sentences: [] }];
let stories = [];
let content = "";

// to format the data based on the words count
const formData = (word) => {
  wordsCount += 1;
  if (paragraphsCount >= 6) {
    stories.push([storyId, paragraphsList.length]);
    storyId += 1;
    paragraphsCount = 0;
    paragraphsList = [{ sentences: [] }];
    wordsCount = 1;
    title = "";
  }

  if (wordsCount <= 2) {
    title = title + " " + word;
    title = title.trim();
  } else {
    sentenceLength += 1;
    if (sentenceLength <= 10) {
      currentSentence = currentSentence + " " + word;
      currentSentence = currentSentence.trim();
    } else {
      sentenceLength = 1;
      currentSentence = "";
      currentSentence = currentSentence + " " + word;
      currentSentence = currentSentence.trim();
      sentencesCount += 1;
    }
  }
  if (sentencesCount > 15) {
    paragraphsCount += 1;
    sentencesCount = 0;
    paragraphsList[paragraphsCount] = { sentences: [] };
  }

  paragraphsList[paragraphsCount].sentences[sentencesCount] = currentSentence;
};

//to convert database object to response object
const convertDbObjToResponseObj = (dbObj) => {
  let responseObj = {
    id: dbObj.id,
    title: dbObj.title,
    created_at: dbObj.created_at,
    updated_at: dbObj.updated_at,
    paragraphs: JSON.parse(dbObj.body),
  };
  return responseObj;
};

//to convert database list item to response list item
const convertDbListItemToResponseListItem = (each) => {
  let eachItem = {
    id: each.id,
    title: each.title,
    created_at: each.created_at,
    updated_at: each.updated_at,
  };
  return eachItem;
};

// API 1 to write words into database
app.post("/add", async (request, response) => {
  const { word } = request.body;

  if (word.includes(" ")) {
    response.status(400);
    let errorMsg = {
      error: "multiple words sent",
    };
    response.send(errorMsg); // sends error message if more than one word is given as input
  } else {
    formData(word);

    content = JSON.stringify(paragraphsList);

    //to write data into database
    if (wordsCount === 1) {
      let date = new Date();
      const putQuery = `insert into story(id,title,body,created_at)
                     values ('${storyId}','${title}','${content}','${date}');`;
      const dbQuery = await database.run(putQuery);
    } else if (wordsCount === 2) {
      let date = new Date();
      const updateTitleQuery = `update story
                        set title='${title}',updated_at='${date}'
                        where id='${storyId}';`;
      const dbQuery = await database.run(updateTitleQuery);
    } else {
      let date = new Date();
      const updateQuery = `update story
                        set body='${content}',updated_at='${date}'
                        where id='${storyId}';`;
      const dbQuery = await database.run(updateQuery);
    }

    let result = {
      id: storyId,
      title: title,
      current_sentence: currentSentence,
    };
    response.send(result);
  }
});

//API 2 to get specific story from the database by using its id
app.get("/stories/:storyId", async (request, response) => {
  const { storyId } = request.params;

  const getQuery = `select *
                    from story
                    where id='${storyId}';`;

  const dbQuery = await database.get(getQuery);
  let result = convertDbObjToResponseObj(dbQuery);
  response.send(result);
});

//API 3 to get stories from the database
app.get("/stories", async (request, response) => {
  const { limit, offset, sort = "created_at", order = "asc" } = request.body;

  const getQuery = `select id,title,created_at,updated_at
                    from story
                    order by '${sort}' ${order}
                    limit '${limit}'
                    offset '${offset}';`;
  const dbQuery = await database.all(getQuery);

  let resultsList = dbQuery.map((each) =>
    convertDbListItemToResponseListItem(each)
  );
  let responseObj = {
    limit: limit,
    offset: offset,
    count: resultsList.length,
    results: resultsList,
  };

  response.send(responseObj);
});

module.exports = app;
