var path = require('path');
var express = require('express');
var env = require('node-env-file');
var mongodb = require('mongodb');

var app = express();

env(__dirname + '/.env');

// to prettify JSON output
app.set('json spaces', 40);

// to serve static files without routes
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.get('/new', (req, res) => {
  var fullURL = req.query['url'];
  // TODO: validate the given URL
  if (!fullURL.match(/^http[s]*:\/\/(.)+\.(.)+[\/]*/gi)) {
    res.json({
      err: 'Invalid URL entered'
    });
  }
  
  console.log('URL: ', fullURL);
  mongodb.connect(process.env.MONGODB, (err, db) => {
    if (err) throw { msg: "Connectivity Problems.", err: err };
    
    console.log('Connection established...');
    var doc;
    var urls = db.collection('urls');
    try {
      // check if the URL is in the database
      urls.find({
        "fullURL": fullURL
      }).toArray((err, docs) => {
        if (err) throw { msg: "Connectivity Problems.", err: err };
        
        console.log(docs);
        if (docs.length > 0) {
          // if already present in the database
          res.json({
            short_url: docs[0].shortURL,
            original_url: docs[0].fullURL
          });
        } else {
          // get the shortURL of last doc from DB
          urls.find({}).sort({_id:-1}).limit(1).toArray((err, docs) => {
            if (err) throw { msg: "Connectivity Problems.", err: err };
            
            console.log('Last Doc:', docs);
            var lastURL;
            if (!docs.length) {
              lastURL = 0;
            } else {
              lastURL = docs[0].shortURL;
            }
            doc = {
              shortURL: +lastURL+1,
              fullURL: fullURL
            };
            urls.insert(doc, (err, data) => {
              if (err) throw { msg: "Connectivity Problems.", err: err };
              
              res.json({
                short_url: doc.shortURL,
                original_url: doc.fullURL
              });
              db.close();
              console.log('Connections closed...')
            });
          });
        }
      });
    } catch (e) {
      // handle the exceptions
      console.log(e);
      res.json({
        error: e.msg,
        detail: e.err
      });
    }
  });
});

// URL Redirection code
app.get('/:shortID', (req, res) => {
  // get the shortID from URL
  var shortID = req.params.shortID;
  mongodb.connect(process.env.MONGODB, (err, db) => {
    if (err) throw err;
    
    console.log('Connection established...');
    var urls = db.collection('urls');
    var doc = urls.find({
      shortURL: Number(shortID)
    }).toArray((err, docs) => {
      if (err) throw err;
      
      if (docs.length) {
        res.status(308).redirect(docs[0].fullURL);
      } else {
        res.status(404).send();
      }
      db.close();
    });
  });
  
});

var listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});