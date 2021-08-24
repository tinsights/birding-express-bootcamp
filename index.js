import express from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';

const SALT = 'why are we doing this';

const { Pool } = pg;

const pgConnectionConfigs = {
  user: 'tail',
  host: 'localhost',
  database: 'birding',
  port: 5432,
};

const pool = new Pool(pgConnectionConfigs);

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cookieParser());

setTimeout(() => {
  // GET method routers
  app.get('/', allNotes);
  app.get('/note', submitNote);
  app.post('/note', submitNote);
  app.get('/note/:id', showNote);
  app.get('/login', login);
  app.post('/login', login);
  // app.delete('/logout', logout);
  app.get('/signup', signup);
  app.post('/signup/', signup);

  // COMFORTABLE
  // app.get('/note/:id/edit', editNote);
  // app.put('/note/:id/edit', editNote);
  // app.delete('/note/:id/delete', deleteNote);
  // app.get('/species', newSpecies);
  // app.post('/species', newSpecies);
  // app.get('/species/:id', notesBySpecies);
  // app.get('/species/all', allSpecies);
  // app.get('/species/:id/edit', editSpecies);
  // app.put('/species/:id/edit', editSpecies);
  // app.delete('/species/:id/delete', deleteSpecies);
  // app.get('/behaviours', behaviours);
  // app.get('/behaviours/:id', behaviours);
  app.use((req, res) => {
    res.status(404).send('404 NOT FOUND');
  });

  app.listen(3004);
}, 0);

const allNotes = (req, res) => {
  console.log('rendering all notes');
  const allQuery = 'SELECT notes.id, notes.summary FROM notes';
  pool.query(allQuery, (err, result) => {
    if (err) throw err;
    else {
      console.log(result.rows);
      const allNotes = result.rows;
      console.log(allNotes);
      const { loggedIn } = req.cookies;
      console.log('logged in?', loggedIn);
      const content = {
        title: 'Bird Watching',
        header: 'Bird Watching',
        allNotes,
        page: 1,
      };
      res.render('all', content);
    }
  });
};

const submitNote = (req, res) => {
  if (req.method === 'GET') {
    console.log('Getting note submission form!');
    const speciesQuery = 'SELECT * FROM species';
    pool.query(speciesQuery, (speciesQueryError, speciesQueryResult) => {
      if (speciesQueryError) {
        console.log('error', speciesQueryError);
      } else {
        const data = {
          species: speciesQueryResult.rows,
        };
        res.render('note', data);
      }
    });
  }
  else if (req.method === 'POST') {
    const entryQuery = 'INSERT INTO notes (flock_size, date, user_id, species_id, summary) VALUES ($1, $2, $3, $4, $5) returning id';

    const birdData = req.body;
    // console.log(Number(req.cookies.userId));
    console.log('behaviour:', birdData.behaviour);

    const inputData = [Number(birdData.flock_size), birdData.date, 1, Number(birdData.species_id), birdData.summary];

    pool.query(entryQuery, inputData, (entryError, entryResult) => {
      if (entryError) {
        console.log('error', entryError);
      } else {
        console.log('note id:', entryResult.rows);
        const noteId = entryResult.rows[0].id;
        console.log(noteId);
        console.log('behaviour:', birdData.behaviour);

        birdData.behaviour.forEach((behaviour) => {
          const behaviourIdQuery = `SELECT id FROM behaviour WHERE behaviour = '${behaviour}'`;

          pool.query(behaviourIdQuery, (behaviourIdQueryError, behaviourIdQueryResult) => {
            if (behaviourIdQueryError) {
              console.log('error', behaviourIdQueryError);
            } else {
              console.log('behaviour id:', behaviourIdQueryResult.rows);
              const behaviourId = behaviourIdQueryResult.rows[0].id;
              const behaviourData = [noteId, behaviourId];

              const notesBehaviourEntry = 'INSERT INTO notes_behaviours (notes_id, behaviour_id) VALUES ($1, $2)';

              pool.query(notesBehaviourEntry, behaviourData, (notesBehaviourEntryError, notesBehaviourEntryResult) => {
                if (notesBehaviourEntryError) {
                  console.log('error', notesBehaviourEntryError);
                } else {
                  console.log('done');
                }
              });
            }
          });
        });
        res.redirect('/');
      }
    });
  }
};

const showNote = (req, res) => {
  const { id } = req.params;
  console.log('id :>> ', id);
  const singleNote = `SELECT notes.id, notes.flock_size, notes.date, users.email, species.name AS species FROM notes INNER JOIN users ON notes.user_id = users.id INNER JOIN species ON species.id = notes.species_id WHERE notes.id = ${id}`;

  pool.query(singleNote, (singleNoteError, singleNoteResult) => {
    if (singleNoteError) {
      console.log('error', singleNoteError);
    } else {
      console.log(singleNoteResult.rows[0]);
      const oneNote = singleNoteResult.rows[0];
      console.log('one note', oneNote);
      const { loggedIn } = req.cookies;
      console.log('logged in?', loggedIn);
      res.render('sighting', { eachNote: oneNote, loggedIn });
    }
  });
};

const signup = (req, res) => {
  if (req.method === 'GET') {
    res.render('signup');
  }
  else if (req.method === 'POST') {
    const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

    shaObj.update(req.body.password);

    const hashedPassword = shaObj.getHash('HEX');

    const newUserQuery = 'INSERT INTO users (email, username, password) VALUES ($1, $2, $3)';
    const inputData = [req.body.email, req.body.username, hashedPassword];

    pool.query(newUserQuery, inputData, (newUserQueryError, newUserQueryResult) => {
      if (newUserQueryError) {
        console.log('error', newUserQueryError);
      } else {
        console.log(newUserQueryResult.rows);
        res.redirect('/login');
      }
    });
  }
};

// displays the login form
app.get('/login', (req, res) => {
  const { loggedIn } = req.cookies;
  res.render('login', { loggedIn });
});

// submits the login data
const login = (req, res) => {
  if (req.method === 'GET') {
    const { loggedIn } = req.cookies;
    res.render('login', { loggedIn });
  }
  else if (req.method === 'POST') {
    pool.query(`SELECT * FROM users WHERE email = '${req.body.email}'`, (emailQueryError, emailQueryResult) => {
      if (emailQueryError) {
        console.log('error', emailQueryError);
        res.status(503).send('request not successful');
        return;
      }

      if (emailQueryResult.rows.length === 0) {
        res.status(403).send('not successful');
        return;
      }

      console.log('password', emailQueryResult.rows[0].password);

      const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
      shaObj.update(req.body.password);
      const hashedPassword = shaObj.getHash('HEX');
      console.log(hashedPassword);
      if (emailQueryResult.rows[0].password === hashedPassword) {
        res.cookie('loggedIn', true);

        const shaObj1 = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
        const unhashedCookieString = `${emailQueryResult.rows[0].id}-${SALT}`;
        shaObj1.update(unhashedCookieString);
        const hashedCookieString = shaObj1.getHash('HEX');
        res.cookie('loggedInHash', hashedCookieString);
        res.cookie('userId', emailQueryResult.rows[0].id);
        res.redirect('/');
      } else {
        res.status(403).send('not successful');
      }
    });
  }
};
