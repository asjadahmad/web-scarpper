let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let xl = require("excel4node");
let pdf = require("pdf-lib");
let path = require("path");
let fs = require("fs");
let args = minimist(process.argv);
let responePromise = axios.get(args.source);
responePromise.then(function (response) {
  let html = response.data;

  let dom = new jsdom.JSDOM(html);
  let document = dom.window.document;

  let matches = [];

  let matchScoreDiv = document.querySelectorAll("div.match-score-block");

  for (let i = 0; i < matchScoreDiv.length; i++) {
    let match = {
      t1: "",
      t2: "",
      t1s: "",
      t2s: "",
      result: "",
    };

    let matchDiv = matchScoreDiv[i];

    let teampara = matchDiv.querySelectorAll("div.name-detail > p.name");

    match.t1 = teampara[0].textContent;
    match.t2 = teampara[1].textContent;

    let ScoreSpan = matchDiv.querySelectorAll("div.score-detail > span.score");

    if (ScoreSpan.length == 2) {
      match.t1s = ScoreSpan[0].textContent;
      match.t2s = ScoreSpan[1].textContent;
    } else if (ScoreSpan.length == 1) {
      match.t1s = ScoreSpan[0].textContent;
      match.t2s = "";
    } else {
      match.t1s = "";
      match.t2s = "";
    }

    let resultSpan = matchDiv.querySelector("div.status-text > span");
    match.result = resultSpan.textContent;

    matches.push(match);
  }

  let teams = [];

  for (let i = 0; i < matches.length; i++) {
    populateTeams(teams, matches[i]);
  }

  for (let i = 0; i < matches.length; i++) {
    putMatch(teams, matches[i]);
  }

  let teamsJSON = JSON.stringify(teams);
  fs.writeFileSync("teams.json", teamsJSON, "utf-8");

  createExcelFile(teams);

  createFolder(teams);
});

function createFolder(teams) {
  fs.mkdirSync(args.dataFolder);
  for (let i = 0; i < teams.length; i++) {
    let teamFolder = path.join(args.dataFolder, teams[i].name);
    fs.mkdirSync(teamFolder);

    for (let j = 0; j < teams[i].matches.length; j++) {
      let match = path.join(teamFolder, teams[i].matches[j].vs + ".pdf");
      createScoreCard(teams[i].name, teams[i].matches[j], match);
    }
  }
}
function createScoreCard(teamName, match, matchFileName) {
  let t1 = teamName;
  let t2 = match.vs;
  let t1s = match.selfScore;
  let t2s = match.oppScore;
  let result = match.result;

  let originalBytes = fs.readFileSync("Template.pdf");

  let pdfPromise = pdf.PDFDocument.load(originalBytes);

  pdfPromise.then(function (pdfdoc) {
    let page = pdfdoc.getPage(0);

    page.drawText(t1, {
      x: 320,
      y: 757,
      size: 8,
    });

    page.drawText(t2, {
      x: 320,
      y: 728,
      size: 8,
    });

    page.drawText(t1s, {
      x: 320,
      y: 700,
      size: 8,
    });

    page.drawText(t2s, {
      x: 320,
      y: 673,
      size: 8,
    });

    page.drawText(result, {
      x: 320,
      y: 644,
      size: 8,
    });

    let changedBytesPromise = pdfdoc.save();

    changedBytesPromise.then(function (changedBytes) {
      fs.writeFileSync(matchFileName, changedBytes);
    });
  });
}

function populateTeams(teams, match) {
  let t1idx = -1;

  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == match.t1) {
      t1idx = i;
      break;
    }
  }

  if (t1idx == -1) {
    teams.push({
      name: match.t1,
      matches: [],
    });
  }

  let t2idx = -1;

  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == match.t2) {
      t2idx = i;
      break;
    }
  }

  if (t2idx == -1) {
    teams.push({
      name: match.t2,
      matches: [],
    });
  }
}

function putMatch(teams, match) {
  let t1idx = -1;

  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == match.t1) {
      t1idx = i;
      break;
    }
  }

  let team1 = teams[t1idx];
  team1.matches.push({
    vs: match.t2,
    selfScore: match.t1s,
    oppScore: match.t2s,
    result: match.result,
  });

  let t2idx = -1;

  for (let i = 0; i < teams.length; i++) {
    if (teams[i].name == match.t2) {
      t2idx = i;
      break;
    }
  }

  let team2 = teams[t2idx];
  team2.matches.push({
    vs: match.t1,
    selfScore: match.t2s,
    oppScore: match.t1s,
    result: match.result,
  });
}

function createExcelFile(teams) {
  let wb = new xl.Workbook();

  for (let i = 0; i < teams.length; i++) {
    let sheet = wb.addWorksheet(teams[i].name);
    sheet.cell(1, 1).string("vs");
    sheet.cell(1, 2).string("Self - Score");
    sheet.cell(1, 3).string("Opponent - Score");
    sheet.cell(1, 4).string("Result");
    for (let j = 0; j < teams[i].matches.length; j++) {
      sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
      sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
      sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
      sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
    }
  }
  wb.write(args.excel);
}
