const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongodb = require("mongodb");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const mongoClient = mongodb.MongoClient;
const url =
  "mongodb+srv://test_user:9r4dDd8Itvp0Nprb@cluster0.zzynb.mongodb.net?retryWrites=true&w=majority";
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

app.post("/register", async (req, res) => {
  try {
    let userEmail = req.body.email;
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const db = client.db("url_shortener");
    let user = await db
      .collection("users")
      .find({ email: userEmail })
      .toArray();
    if (user.length != 0) {
      res.json({
        stat: "failure",
        message: "user already registered",
      });
      client.close();
      return;
    }
    let userFname = req.body.firstName;
    let userLname = req.body.lastName;
    let password = req.body.password;
    let hashPass = await bcrypt.hash(password, 10);
    let activationLink = crypto.randomBytes(64).toString("hex");
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "noreplyvikaspassreset",
        pass: "passwordreset123",
      },
    });
    var mailOptions = {
      from: "noreplyvikaspassreset",
      to: `${userEmail}`,
      subject: "Register using nodeJS",
      html: `<p>To register <a href = "https://vikas-tinyurl.netlify.app/activate.html?${activationLink}">Click here</a>
        </p>`,
    };

    transporter.sendMail(mailOptions, async function (error, info) {
      if (error) {
        client.close();
        console.log(error);
      } else {
        await db.collection("users").insertOne({
          email: userEmail,
          firstName: userFname,
          lastName: userLname,
          password: hashPass,
          status: "inactive",
          activationLink: activationLink,
        });
        client.close();
        res.json({
          stat: "success",
          message: "Activation link is sent to email, please check",
        });
      }
    });
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.put("/activate", async (req, res) => {
  try {
    let link = req.body.activationLink;
    var client = await mongoClient.connect(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    let db = client.db("url_shortener");
    let user = await db
      .collection("users")
      .find({ activationLink: link })
      .toArray();
    if (user.length == 0) {
      client.close();
      res.json({
        stat: "failure",
        message: "invalid link",
      });
      return;
    } else {
      await db.collection("users").findOneAndReplace(
        { email: user[0].email },
        {
          email: user[0].email,
          firstName: user[0].firstName,
          lastName: user[0].lastName,
          password: user[0].password,
          status: "active",
          resetLink: user[0].resetLink,
        }
      );
      client.close();
      res.json({
        stat: "success",
        message: "you are an active user, login now",
      });
    }
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    let email = req.body.email;
    let password = req.body.password;
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let user = await db.collection("users").findOne({ email: email });
    client.close();
    if (user) {
      let result = await bcrypt.compare(password, user.password);
      if (result) {
        jwt.sign(user, "secretkey", (err, token) => {
          if (err) {
            res.status(500).json({
              stat: "failure",
              message: "something went wrong",
            });
          } else {
            res.json({
              stat: "success",
              message: "allow",
              token: token,
            });
          }
        });
      } else {
        res.json({
          stat: "failure",
          message: "invalid password",
        });
      }
    } else {
      res.json({
        stat: "failure",
        message: "user not found",
      });
    }
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.put("/forgotpassword", async (req, res) => {
  try {
    let email = req.body.email;
    var client = await mongoClient.connect(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    let db = client.db("url_shortener");
    let user = await db.collection("users").findOne({ email: email });
    if (user) {
      let resetLink = crypto.randomBytes(64).toString("hex");
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "noreplyvikaspassreset",
          pass: "passwordreset123",
        },
      });
      var mailOptions = {
        from: "noreplyvikaspassreset",
        to: `${email}`,
        subject: "Change password using nodeJS",
        html: `<p>To change your password <a href = "https://vikas-tinyurl.netlify.app/resetPassword.html?${resetLink}">Click here</a>
        </p>`,
      };

      transporter.sendMail(mailOptions, async function (error, info) {
        if (error) {
          console.log(error);
          client.close();
          res.status(500).json({
            stat: "failure",
            message: "something went wrong",
          });
        } else {
          await db
            .collection("users")
            .findOneAndUpdate(
              { email: email },
              { $set: { resetLink: resetLink } }
            );
          client.close();
          res.json({
            stat: "success",
            message: "password change link is sent to user",
          });
        }
      });
    } else {
      res.json({
        stat: "failure",
        message: "user not found",
      });
    }
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.put("/resetpassword", async (req, res) => {
  try {
    let resetLink = req.body.link;
    let newPass = req.body.password;
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let user = await db.collection("users").findOne({ resetLink: resetLink });
    if (user) {
      let hashPass = await bcrypt.hash(newPass, 10);
      await db.collection("users").findOneAndReplace(
        { resetLink: resetLink },
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          password: hashPass,
          status: user.status,
          activationLink: user.activationLink,
        }
      );
      client.close();
      res.json({
        stat: "success",
        message: "password is reset",
      });
    } else {
      client.close();
      res.json({
        stat: "failure",
        message: "invalid link",
      });
    }
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.post("/createurl", verifyToken, async (req, res) => {
  try {
    let longUrl = req.body.url;
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let checkUrl = await db.collection("urls").findOne({ longUrl: longUrl });
    if (checkUrl) {
      client.close();
      res.json({
        stat: "success",
        shortUrl: checkUrl.shortUrl,
        message: "url for this link is already created",
      });
    } else {
      let shortUrl = crypto.randomBytes(5).toString("hex");
      let today = new Date();
      let year = String(today.getFullYear());
      let date = String(today.getDate());
      let month = String(today.getMonth());
      date = date % 10 == date ? "0" + date : date;
      month = month % 10 == month ? "0" + month : month;
      await db.collection("urls").insertOne({
        shortUrl: shortUrl,
        longUrl: longUrl,
        createdOnDate: new Date(`${year}-${month}-${date}`),
        createdInMonth: new Date(`${year}-${month}-01`),
      });

      client.close();
      res.json({
        stat: "success",
        shortUrl: shortUrl,
        message: "short url created",
      });
    }
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.get("/allurls", verifyToken, async (req, res) => {
  try {
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let allUrls = await db
      .collection("urls")
      .find({}, { shortUrl: 1, longUrl: 1, _id: 0 })
      .toArray();
    client.close();
    res.json({
      stat: "success",
      data: allUrls,
    });
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.get("/dashboardinfo", verifyToken, async (req, res) => {
  try {
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let urlsOnDate = await db
      .collection("urls")
      .aggregate([
        {
          $match: {},
        },
        {
          $group: { _id: "$createdOnDate", total: { $sum: 1 } },
        },
      ])
      .toArray();
    let urlsInMonth = await db
      .collection("urls")
      .aggregate([
        {
          $match: {},
        },
        {
          $group: { _id: "$createdInMonth", total: { $sum: 1 } },
        },
      ])
      .toArray();
    client.close();
    noOfUrlsPerDay = urlsOnDate.reduce((acc, curr) => acc + curr.total, 0);
    noOfUrlsPerMonth = urlsInMonth.reduce((acc, curr) => acc + curr.total, 0);
    noOfUrlsPerDay = Math.round(noOfUrlsPerDay / urlsOnDate.length);
    noOfUrlsPerMonth = Math.round(noOfUrlsPerMonth / urlsInMonth.length);
    res.json({
      stat: "success",
      perDay: noOfUrlsPerDay,
      perMonth: noOfUrlsPerMonth,
    });
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.get("/longurl/:shorturl", async (req, res) => {
  try {
    let shortUrl = req.params.shorturl;
    var client = await mongoClient.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    let db = client.db("url_shortener");
    let urlInfo = await db.collection("urls").findOne({ shortUrl: shortUrl });
    client.close();
    res.json({
      stat: "success",
      longUrl: urlInfo.longUrl,
    });
  } catch (error) {
    if (client) {
      client.close();
    }
    console.log(error);
    res.status(500).json({
      stat: "failure",
      message: "something went wrong",
    });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("server started"));

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  jwt.verify(token, "secretkey", (err, decode) => {
    if (err) {
      res.json({
        stat: "failure",
        message: "invalid token",
      });
    } else {
      req.body.user = decode;
      next();
    }
  });
}
