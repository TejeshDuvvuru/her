"use strict";
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
let bodyParser = require("body-parser");
let morgan = require("morgan");
// let nodemailer = require("nodemailer");
let pg = require("pg");
let cors = require("cors");
// var mv = require("mv");
require("dotenv").config();
var CryptoJS = require("crypto-js");

var userProfile;
const dotenv = require("dotenv");

var passport = require("passport");
var saml = require("passport-saml").Strategy;
const cookieSession = require("cookie-session");
const cookieParser = require("cookie-parser"); //    parse cookie header
// const saltRounds = 10;
dotenv.config();
const key = process.env.ENCRYPT_KEY;
const iv = process.env.ENCRYPT_IV;
const user = process.env.REACT_APP_POSTGRESUSER;
const database = process.env.REACT_APP_POSTGRESDB;
var hw = {
  iv: iv.toString("hex"),
  encryptedData: process.env.REACT_APP_POSTGRESPASSWORD,
};
const password = decrypt(hw);
const dbport = process.env.REACT_APP_POSTGRESPORT;
const dbhost = process.env.REACT_APP_POSTGRESHOST;
const schema = process.env.REACT_APP_POSTGRESCHEMA;
const postgresssl = process.env.REACT_APP_POSTGRESSSL;
var sslflag = true;
if (postgresssl == "false") {
  sslflag = false;
}


const reactbaseurl = process.env.REACT_APP_RUNNING_BASEURL;
// const neatCsv = require("neat-csv");
const app = express();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
function decrypt(text) {
  //let iv = Buffer.from(text.iv, "hex");
  let encryptedText = Buffer.from(text.encryptedData, "hex");
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
app.set("views", path.join(__dirname, "client"));
app.set("view engine", "ejs");
// Serve static files from the React app
app.use(express.static(path.join(__dirname, "client/build")));
//app.use('/public', express.static('public'));

let pool = new pg.Pool({
  user: user,
  host: dbhost,
  database: database,
  password: password,
  port: dbport,
  max: 10,
  ssl: sslflag,
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  cookieSession({
    name: "session",
    secret: process.env.REACT_APP_SESSION_SECRET,
    saveUninitialized: true,
    resave: false,
    maxAge: 24 * 60 * 60 * 100,
  })
);
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
//passport.use(user.createStrategy());

// saml strategy for passport
var strategy = new saml(
  {
    path: process.env.REACT_APP_CALLBACK_PATH,
    entryPoint: process.env.REACT_APP_ENTRYPOINT,
    issuer: process.env.REACT_APP_ISSUER,
    cert: process.env.REACT_APP_CERTFICATE,
    identifierFormat: process.env.REACT_APP_IDENTIFIER_FORMAT,
  },
  (profile, done) => {
    userProfile = profile;
    console.log(userProfile);
    done(null, userProfile);
  }
);

passport.use(strategy);

var redirectToLogin = (req, res, next) => {
  if (!req.isAuthenticated() || userProfile == null || !req.session == null) {
    return res.redirect("/app/login");
  }
  next();
};
app.get("/app", redirectToLogin, (req, res) => {
  let count;
  console.log("gett:" + userProfile);
  usersData(userProfile.username)
    .then((results) => {
      if (results[0] == "") {
        count = 0;
      } else {
        try {
          count = results[0].count;
        } catch (e) {
          count = 0;
        }
      }
      if (count == 0) {
        console.log("count 0000:");
        var date = new Date();
        var textForEncryption = userProfile.username;
        var ciphertext = CryptoJS.AES.encrypt(
          textForEncryption,
          date.toISOString().slice(0, 10)
        );
        console.log("encrypted text", ciphertext.toString());
        const lastname = userProfile.lastname;
        const firstname = userProfile.firstname;
        const email = userProfile.email;
        const username = userProfile.username;
        const status = "Approved";
        const role = 8;
        const businessjustification = "Data@Salesforce Login";
        const usecase = "Data@Salesforce Access";
        const departments_businessunit = null;
        const createdon = new Date();
        const createdby = "User";
        const activity = "Active";
        const count = 0;
        pool.connect(function (err, db, done) {
          if (err) {
            return res.status(400).send(err);
          } else {
            console.log("flow enters :" + count);
            db.query(
              "INSERT INTO " +
                schema +
                ".users (lastname,firstname,mailid,status,role,businessjustification,usecase,departments_businessunit,createdby,createdon,username,activity,count) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
              [
                lastname,
                firstname,
                email,
                status,
                role,
                businessjustification,
                usecase,
                departments_businessunit,
                createdby,
                createdon,
                username,
                activity,
                count,
              ],
              (err, table) => {
                done();
                if (err) {
                  // console.log("User Already exists with email id or first and lastname");
                  console.log(err);
                  // res.sendStatus(500);
                  res.status(400).send(err);
                  return;
                } else {
                  console.log("User Inserted" + table.rows[0].id);
                  analytics(
                    email,
                    firstname + " " + lastname,
                    "User",
                    "Create",
                    "Users",
                    table.rows[0].id,
                    null,
                    null
                  );
                  //return console.log(" Registered User Inserted");
                }
              }
            );
          }
        });
        res.redirect(
          `${reactbaseurl}/UXPortal#/App/?usertoken=` + ciphertext.toString()
        );
      } else {
        console.log("count 1111");
        console.log(
          " status:" +
            results[0].status +
            "    + activity:" +
            results[0].activity
        );
        /*  var mykey = crypto.createCipheriv("aes-128-gcm", "mypassword",iv);
        var mystr = mykey.update(userProfile.username, "utf8", "hex");
        mystr += mykey.final("hex");
        console.log("usertoken:" + mystr);*/
        var date = new Date();
        var textForEncryption = userProfile.username;
        console.log("textForEncryption", textForEncryption);
        console.log("date", date.toISOString().slice(0, 10));
        var ciphertext = CryptoJS.AES.encrypt(
          textForEncryption,
          date.toISOString().slice(0, 10)
        );
        console.log("encrypted text", ciphertext.toString());
        if (
          results[0].activity === "Active" &&
          results[0].status === "Approved"
        ) {
          console.log("homepage");
          res.redirect(
            `${reactbaseurl}/UXPortal#/App/?usertoken=` + ciphertext.toString()
          );
        } else {
          const lastname = userProfile.lastname;
          const firstname = userProfile.firstname;
          const email = userProfile.email;
          const username = userProfile.username;
          const status = "Approved";
          const role = 8;
          const businessjustification = "Data@Salesforce Login";
          const usecase = "Data@Salesforce Access";
          const departments_businessunit = null;
          const createdon = new Date();
          const createdby = "User";
          const activity = "Active";
          const count = 0;
          pool.connect(function (err, db, done) {
            if (err) {
              return res.status(400).send(err);
            } else {
              console.log("flow enterss2 :" + count);

              db.query(
                "INSERT INTO " +
                  schema +
                  ".users (lastname,firstname,mailid,status,role,businessjustification,usecase,departments_businessunit,createdby,createdon,username,activity,count) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
                [
                  lastname,
                  firstname,
                  email,
                  status,
                  role,
                  businessjustification,
                  usecase,
                  departments_businessunit,
                  createdby,
                  createdon,
                  username,
                  activity,
                  count,
                ],
                (err, table) => {
                  done();
                  if (err) {
                    // console.log("User Already exists with email id or first and lastname");
                    console.log(err);
                    res.status(400).send(err);
                    // res.sendStatus(500);
                    return;
                  } else {
                    console.log("User Inserted" + table.rows[0].id);
                    analytics(
                      email,
                      firstname + " " + lastname,
                      "User",
                      "Create",
                      "Users",
                      table.rows[0].id,
                      null,
                      null
                    );
                    //    return console.log(" Registered User Inserted");
                  }
                }
              );
            }
          });
          res.redirect(`${reactbaseurl}/UXPortal#/App/?usertoken=` + username);
        }
      }
    })
    .catch((err) => {
      // process error here
      console.log(err);
    });
  //reactjsData(userProfile,res);
  // return res.send(userProfile.email);
  // res.sendFile(path.join(__dirname +"/public/index.html"));
});


app.get("/appp", redirectToLogin, (req, result) => {
  let username 
  for (const key in req.query) {
    if (key === "username") {
       username = req.query[key].replace("/", "");
    }
  }
  console.log("username:aloha" + username);
  console.log("userProfile.username:" + userProfile.username);

  if (username == userProfile.username) {
    let count;
    console.log("gett:" + userProfile);
    usersData(userProfile.username)
      .then((results) => {
        if (results[0] == "") {
          count = 0;
        } else {
          try {
            count = results[0].count;
          } catch (e) {
            count = 0;
          }
        }
        if (count == 0) {
          console.log("count 0000:");
          var date = new Date();
          var textForEncryption = userProfile.username;
          console.log("textForEncryption", textForEncryption);
          console.log("date", date.toISOString().slice(0, 10));
          var ciphertext = CryptoJS.AES.encrypt(
            textForEncryption,
            date.toISOString().slice(0, 10)
          );
          console.log("encrypted text", ciphertext.toString());
          const lastname = userProfile.lastname;
          const firstname = userProfile.firstname;
          const email = userProfile.email;
          const username = userProfile.username;
          const status = "Approved";
          const role = 8;
          const businessjustification = "Data@Salesforce Login";
          const usecase = "Data@Salesforce Access";
          const departments_businessunit = null;
          const createdon = new Date();
          const createdby = "User";
          const activity = "Active";
          const count = 0;
          pool.connect(function (err, db, done) {
            if (err) {
              return res.status(400).send(err);
            } else {
              console.log("flow enters3 :" + count);
              db.query(
                "INSERT INTO " +
                  schema +
                  ".users (lastname,firstname,mailid,status,role,businessjustification,usecase,departments_businessunit,createdby,createdon,username,activity,count) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
                [
                  lastname,
                  firstname,
                  email,
                  status,
                  role,
                  businessjustification,
                  usecase,
                  departments_businessunit,
                  createdby,
                  createdon,
                  username,
                  activity,
                  count,
                ],
                (err, table) => {
                  done();
                  if (err) {
                    // console.log("User Already exists with email id or first and lastname");
                    console.log(err);
                    res.status(400).send(err);
                    // res.sendStatus(500);
                    return;
                  } else {
                    console.log("User Inserted" + table.rows[0].id);
                    analytics(
                      email,
                      firstname + " " + lastname,
                      "User",
                      "Create",
                      "Users",
                      table.rows[0].id,
                      null,
                      null
                    );
                    //return console.log(" Registered User Inserted");
                  }
                }
              );
            }
          });
          res.redirect(
            `${reactbaseurl}/UXPortal#/App/?usertoken=` + ciphertext.toString()
          );
        } else {
          console.log("count 1111");
          console.log(
            " status:" +
              results[0].status +
              "    + activity:" +
              results[0].activity
          );
          /*  var mykey = crypto.createCipheriv("aes-128-gcm", "mypassword",iv);
        var mystr = mykey.update(userProfile.username, "utf8", "hex");
        mystr += mykey.final("hex");
        console.log("usertoken:" + mystr);*/
          var date = new Date();
          var textForEncryption = userProfile.username;
          console.log("textForEncryption", textForEncryption);
          console.log("date", date.toISOString().slice(0, 10));
          var ciphertext = CryptoJS.AES.encrypt(
            textForEncryption,
            date.toISOString().slice(0, 10)
          );
          console.log("encrypted text", ciphertext.toString());

          if (
            results[0].activity === "Active" &&
            results[0].status === "Approved"
          ) {
            console.log("homepage");
            res.redirect(
              `${reactbaseurl}/UXPortal#/App/?usertoken=` +
                ciphertext.toString()
            );
          } else {
            const lastname = userProfile.lastname;
            const firstname = userProfile.firstname;
            const email = userProfile.email;
            const username = userProfile.username;
            const status = "Approved";
            const role = 8;
            const businessjustification = "Data@Salesforce Login";
            const usecase = "Data@Salesforce Access";
            const departments_businessunit = null;
            const createdon = new Date();
            const createdby = "User";
            const activity = "Active";
            const count = 0;
            pool.connect(function (err, db, done) {
              if (err) {
                return res.status(400).send(err);
              } else {
                console.log("flow enters4 :" + count);
                db.query(
                  "INSERT INTO " +
                    schema +
                    ".users (lastname,firstname,mailid,status,role,businessjustification,usecase,departments_businessunit,createdby,createdon,username,activity,count) VALUES ($1, $2, $3, $4, $5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
                  [
                    lastname,
                    firstname,
                    email,
                    status,
                    role,
                    businessjustification,
                    usecase,
                    departments_businessunit,
                    createdby,
                    createdon,
                    username,
                    activity,
                    count,
                  ],
                  (err, table) => {
                    done();
                    if (err) {
                      // console.log("User Already exists with email id or first and lastname");
                      console.log(err);
                      // res.sendStatus(500);
                      res.status(400).send(err);
                      return;
                    } else {
                      console.log("User Inserted" + table.rows[0].id);
                      analytics(
                        email,
                        firstname + " " + lastname,
                        "User",
                        "Create",
                        "Users",
                        table.rows[0].id,
                        null,
                        null
                      );
                    }
                  }
                );
              }
            });
            res.redirect(
              `${reactbaseurl}/UXPortal#/App/?usertoken=` +
                ciphertext.toString()
            );
          }
        }
      })
      .catch((err) => {
        // process error here
        console.log(err);
      });
  } else {
    return result.redirect("/app/login");
  }
});



app.get(
  "/app/login",
  passport.authenticate("saml", {
    successRedirect: "/app",
    failureRedirect: "/app/login",
  })
);

app.get("/app/failed", (req, res) => {
  res.status(401).send("Login failed");
});

app.post(
  process.env.REACT_APP_CALLBACK_PATH,
  passport.authenticate("saml", {
    failureRedirect: "/app/failed",
    failureFlash: true,
  }),
  (req, res) => {
    // saml assertion extraction from saml response
    // var samlResponse = res.req.body.SAMLResponse;
    // var decoded = base64decode(samlResponse);
    // var assertion =
    // 	('<saml2:Assertion' + decoded.split('<saml2:Assertion')[1]).split(
    // 		'</saml2:Assertion>'
    // 	)[0] + '</saml2:Assertion>';
    // var urlEncoded = base64url(assertion);

    // success redirection to /app
    console.log("Callbackkkkk");
    return res.redirect("/app");
  }
);

app.post("/app/home", (req, res) => {
  res.render("home", {
    title: "Express Web Application",
    heading: "Express Web Application",
  });
});


async function usersData(username) {
  console.log("hhhhhhhhh:" + username);
  let results = [];
  console.log(
    "users query:" +
      "select count(*)," +
      schema +
      ".users.username,mailid,firstname,lastname," +
      schema +
      ".users.status,activity,departments_businessunit," +
      schema +
      ".roles.name as roleName from " +
      schema +
      ".users INNER JOIN " +
      schema +
      ".roles ON " +
      schema +
      ".users.role=" +
      schema +
      ".roles.id where LOWER(username)=LOWER('" +
      username +
      "') group by username,roleName,mailid,firstname,lastname," +
      schema +
      ".users.status,activity,departments_businessunit"
  );
  let tabledata = await pool.query(
    "select count(*)," +
      schema +
      ".users.username,mailid,firstname,lastname," +
      schema +
      ".users.status,activity,departments_businessunit," +
      schema +
      ".roles.name as roleName from " +
      schema +
      ".users INNER JOIN " +
      schema +
      ".roles ON " +
      schema +
      ".users.role=" +
      schema +
      ".roles.id where LOWER(username)=LOWER('" +
      username +
      "') group by username,roleName,mailid,firstname,lastname," +
      schema +
      ".users.status,activity,departments_businessunit"
  );

  for (let tablerow of tabledata.rows) {
    try {
      results.push({
        count: tablerow.count,
        username: tablerow.username,
        roleName: tablerow.rolename,
        status: tablerow.status,
        activity: tablerow.activity,
        firstname: tablerow.firstname,
        lastname: tablerow.lastname,
        departments_businessunit: tablerow.departments_businessunit,
        mailid: tablerow.mailid,
      });
      //}
    } catch (e) {
      if (e instanceof TypeError) {
        // statements to handle TypeError exceptions
      } else {
        // process error here
        console.log(e);
      }
    }
  }

  console.log(results);
  return results;
}


app.get("/api/userfullnamebyUsername", function (request, response) {
  let username 
  for (const key in request.query) {
    if (key === "username") {
      username = request.query[key];
    }
  }
  // var dbquery = "";
  console.log(`user username:${username}`);
  // dbquery =
    
  // console.log("user full name:" + dbquery);
  pool.connect(function (err, db, done) {
    if (err) {
      return response.status(400).send(err);
    } else {
      db.query("SELECT " +
      schema +
      ".users.firstname," +
      schema +
      ".users.lastname," +
      schema +
      ".users.mailid,role," +
      schema +
      ".business_unit.name  as departments_businessunit," +
      schema +
      ".users.departments_businessunit as business_unit_id," +
      schema +
      ".roles.name as rolename," +
      schema +
      ".roles.accesslevel from " +
      schema +
      ".users INNER JOIN " +
      schema +
      ".roles ON " +
      schema +
      ".users.role=" +
      schema +
      ".roles.id left JOIN " +
      schema +
      ".business_unit ON " +
      schema +
      ".users.departments_businessunit=" +
      schema +
      ".business_unit.business_unit_id where " +
      schema +
      ".users.username=$1",[username] , (err, results) => {
        done();
        if (err) {
          // console.log("702222222222 errore we dine", err)
          return response.status(400).send(err);
        } else {
          // console.log("7055555555555555 result we done", results.rows)
          return response.status(200).send({rows:results.rows});
        }
      });
    }
  });
});


app.get("/api/getAccessLevelForUser", function (request, response) {
  let roleName ;
  console.log("outside if-----------------------------------=============++++",request.query)
  for (const key in request.query) {
    if (key === "roleName") {
      console.log("-----------------------------------=============++++",request.query)
      roleName = request.query[key];
    }
  }
  pool.connect((err, db, done) => {
    if (err) {
      return console.log(err);
    } else {
      db.query(
        "select a.accesslevel,a.id from " +
          schema +
          ".roles a where a.name= $1" ,
          [roleName],
        (err, results) => {
          done();
          if (err) {
            // console.log("errore we dine", err)
            return response.status(400).send(err);
          } else {
            // console.log("result we done", results.rows)
            return response.status(200).send({rows:results.rows});
          }
        }
      );
    }
  });
});

app.get("/api/getBusinessUnitInformation", function (request, response) {
  var query = "";
 query = 
"select a.name as element_name, a.description , a.url ,a.logoname, a.business_unit, a.taskcategory, b.name as business_unit_name,b.business_unit_id, b.description as business_description  from " + 
  schema +
	".contentlink a inner join " + 
  schema +
	".headers b on a.business_unit = b.business_unit_id " +
  " where a.status='Active' and b.status='Active' and b.name not in ('IntakeForm','Product Tag')  order by b.business_unit_id, a.name";
  pool.connect((err, db, done) => {
    console.log("database",db)
    if (err) {
      console.log("rrrrrrrrrrrrrrrrrrrrrrrr at rrrrrrrrrrrrrrrrrrr" + err)
      return response.status(400).send(err);
    } else {
      db.query(query, (err, results) => {
        done();
        if (err) {
          console.log("ttttttttttttttttttttttttttttttttttttt" + err)
          return response.status(400).send(err);
        } else {
          console.log("resultrows for new query " + results.rows)
          return response.status(200).send({rows:results.rows});
        }
      });
    }
  });
});

app.get("/api/getIntakeFormInformation", function (request, response) {
  var query = "";
  query = 
"select a.name as element_name, a.description , a.url ,a.logoname, a.business_unit, a.taskcategory, b.name as business_unit_name,b.business_unit_id, b.description as business_description  from " + 
  schema +
	".contentlink a inner join " + 
  schema +
	".headers b on a.business_unit = b.business_unit_id " +
  " where a.status='Active' and b.status='Active' and b.name='IntakeForm'  order by b.name, a.name";
 
  pool.connect((err, db, done) => {
    if (err) {
      // console.log("rrrrrrrrrrrrrrrrrrrrrrrr at rrrrrrrrrrrrrrrrrrr" + err)
      return response.status(400).send(err);
    } else {
      db.query(query, (err, results) => {
        done();
        if (err) {
          // console.log("ttttttttttttttttttttttttttttttttttttt" + err)
          return response.status(400).send(err);
        } else {
          // console.log("resultrows for new query " + results.rows)
          return response.status(200).send({rows:results.rows});
        }
      });
    }
  });
});

app.get("/api/getProductTagInformation", function (request, response) {
  var query = "";
  query = 
"select a.name as element_name, a.description , a.url ,a.logoname, a.business_unit, a.taskcategory, b.name as business_unit_name,b.business_unit_id, b.description as business_description  from " + 
  schema +
	".contentlink a inner join " + 
  schema +
	".headers b on a.business_unit = b.business_unit_id " +
  " where a.status='Active' and b.status='Active' and b.name='Product Tag'  order by b.name, a.name";
 
  pool.connect((err, db, done) => {
    if (err) {
      // console.log("rrrrrrrrrrrrrrrrrrrrrrrr at rrrrrrrrrrrrrrrrrrr" + err)
      return response.status(400).send(err);
    } else {
      db.query(query, (err, results) => {
        done();
        if (err) {
          // console.log("ttttttttttttttttttttttttttttttttttttt" + err)
          return response.status(400).send(err);
        } else {
          // console.log("resultrows for new query " + {rows:results.rows})
          return response.status(200).send({rows:results.rows});
        }
      });
    }
  });
});





app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/client/build/index.html"));
});
const port = process.env.PORT || 5000;
app.listen(port);

console.log(`UXPortal Services listening on ${port}`);
