import express from 'express';
import pg from 'pg';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import jsSHA from 'jssha';

const SALT = 'birds are awesome';

const { Pool } = pg;

let pgConnectionConfigs;
if (process.env.ENV === 'PRODUCTION') {
  // determine how we connect to the remote Postgres server
  pgConnectionConfigs = {
    user: 'postgres',
    // set DB_PASSWORD as an environment variable for security.
    password: process.env.DB_PASSWORD,
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
} else {
  // determine how we connect to the local Postgres server
  pgConnectionConfigs = {
    user: 'michellemok',
    host: 'localhost',
    database: 'birding',
    port: 5432,
  };
}

const pool = new Pool(pgConnectionConfigs);

const app = express();
const PORT = process.argv[2];

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cookieParser());

// 3.POCE.5 Bird watching
// display the bird sighting entry form
app.get('/note', (req, res) => {
  const speciesQuery = 'SELECT * FROM species';
  pool.query(speciesQuery, (speciesQueryError, speciesQueryResult) => {
    if (speciesQueryError) {
      console.log('error', speciesQueryError);
    } else {
      const data = {
        species: speciesQueryResult.rows,
      };
      console.log(data);
      res.render('note', data);
    }
  });
});

// enters the data recieved in '/note' into the database
app.post('/note', (req, res) => {
  const entryQuery = 'INSERT INTO notes (flock_size, date, user_id, species_id) VALUES ($1, $2, $3, $4) returning id';

  const birdData = req.body;
  console.log(Number(req.cookies.userId));
  console.log('behaviour:', birdData.behaviour);

  const inputData = [Number(birdData.flock_size), birdData.date, Number(req.cookies.userId), Number(birdData.species_id)];

  pool.query(entryQuery, inputData, (entryError, entryResult) => {
    if (entryError) {
      console.log('error', entryError);
    } else {
      console.log('note id:', entryResult.rows);
      const noteId = entryResult.rows[0].id;
      console.log(noteId);
      console.log('behaviour:', birdData.behaviour);

      birdData.behaviour.forEach((behaviour) => {
        const behaviourIdQuery = `SELECT id FROM behaviour WHERE action = '${behaviour}'`;

        pool.query(behaviourIdQuery, (behaviourIdQueryError, behaviourIdQueryResult) => {
          if (behaviourIdQueryError) {
            console.log('error', behaviourIdQueryError);
          } else {
            console.log('behaviour id:', behaviourIdQueryResult.rows);
            const behaviourId = behaviourIdQueryResult.rows[0].id;
            const behaviourData = [noteId, behaviourId];

            const notesBehaviourEntry = 'INSERT INTO notes_behaviour (notes_id, behaviour_id) VALUES ($1, $2)';

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
});

// displays one single entry in the database
app.get('/note/:id', (req, res) => {
  console.log('logged in', req.cookies.loggedIn);
  console.log('userid', req.body.id);

  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedCookieString = `${req.cookies.userId}-${SALT}`;
  shaObj.update(unhashedCookieString);
  const hashedCookieString = shaObj.getHash('HEX');
  console.log('logged in hash', req.cookies.loggedInHash);
  console.log('hashedCookieString', hashedCookieString);
  if (req.cookies.loggedInHash !== hashedCookieString) {
    res.status(403).send('please log in');
  } else {
    const { id } = req.params;
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
        res.render('single-note', { eachNote: oneNote, loggedIn });
      }
    });
  }
});

// displays all the entries in the database
app.get('/', (req, res) => {
  const allQuery = 'SELECT notes.id, notes.behaviour, notes.flock_size, notes.user_id, notes.species_id, notes.date, species.name FROM notes INNER JOIN species ON notes.species_id = species.id';
  pool.query(allQuery, (allQueryError, allQueryResult) => {
    if (allQueryError) {
      console.log('error', allQueryError);
    } else {
      console.log(allQueryResult.rows);
      const allNotes = allQueryResult.rows;
      const { loggedIn } = req.cookies;
      console.log('logged in?', loggedIn);
      res.render('landing-page', { allNotes, loggedIn });
    }
  });
});

// displays edit form (with user auth)
app.get('/note/:id/edit', (req, res) => {
  const noteId = Number(req.params.id);
  const getNoteInfoQuery = `SELECT * FROM notes WHERE id = ${noteId}`;
  pool.query(getNoteInfoQuery, (getNoteInfoQueryError, getNoteInfoQueryResult) => {
    if (getNoteInfoQueryError) {
      console.log('error', getNoteInfoQueryError);
    } else {
      console.log(getNoteInfoQueryResult.rows);
      const noteInfo = getNoteInfoQueryResult.rows[0];
      if (noteInfo.user_id === Number(req.cookies.userId)) {
        const speciesQuery = 'SELECT * FROM species';
        pool.query(speciesQuery, (speciesQueryError, speciesQueryResult) => {
          if (speciesQueryError) {
            console.log('error', speciesQueryError);
          } else {
            const data = {
              species: speciesQueryResult.rows,
            };

            const editBehaviourQuery = `SELECT behaviour.action FROM behaviour INNER JOIN notes_behaviour ON behaviour.id = notes_behaviour.behaviour_id WHERE notes_id = ${noteId}`;

            pool.query(editBehaviourQuery, (editBehaviourQueryError, editBehaviourQueryResult) => {
              if (editBehaviourQueryError) {
                console.log('error', editBehaviourQueryError);
              } else {
                console.log(editBehaviourQueryResult.rows);
                const behaviourArray = [];
                const behaviours = editBehaviourQueryResult.rows;
                behaviours.forEach((behaviour) => {
                  behaviourArray.push(behaviour.action);
                });
                const displayBehavioursQuery = 'SELECT * FROM behaviour';

                pool.query(displayBehavioursQuery, (displayBehavioursQueryError, displayBehavioursQueryResult) => {
                  if (displayBehavioursQueryError) {
                    console.log('error', displayBehavioursQueryError);
                  } else {
                    console.log(displayBehavioursQueryResult.rows);
                    const allBehaviour = displayBehavioursQueryResult.rows;

                    res.render('edit', {
                      noteInfo, data, behaviourArray, allBehaviour,
                    });
                  }
                });
              }
            });
          }
        });
      } else {
        res.send('You are not authorised to edit this post. ');
      }
    }
  });
});

// submit edit data
app.put('/note/:id/edit', (req, res) => {
  const id = Number(req.params.id);

  const editEntryQuery = `UPDATE notes SET behaviour = '${req.body.behaviour}', flock_size = ${Number(req.body.flock_size)}, date = '${req.body.date}', species_id = ${Number(req.body.species_id)} WHERE id = ${id} RETURNING *`;

  pool.query(editEntryQuery, (editEntryQueryError, editEntryQueryResult) => {
    if (editEntryQueryError) {
      console.log('error', editEntryQueryError);
    } else {
      console.log(editEntryQueryResult.rows);
      res.redirect('/');
    }
  });
});

// deletes a single note
app.delete('/note/:id/delete', (req, res) => {
  const noteId = Number(req.params.id);
  const getNoteInfoQuery = `SELECT * FROM notes WHERE id = ${noteId}`;
  pool.query(getNoteInfoQuery, (getNoteInfoQueryError, getNoteInfoQueryResult) => {
    if (getNoteInfoQueryError) {
      console.log('error', getNoteInfoQueryError);
    } else {
      console.log(getNoteInfoQueryResult.rows);
      const noteInfo = getNoteInfoQueryResult.rows[0];
      console.log('user_id', noteInfo.user_id);
      console.log('userId from cookies', req.cookies.userId);
      console.log('note id:', noteInfo.id);
      console.log('date', noteInfo.date);
      if (noteInfo.user_id === Number(req.cookies.userId)) {
        const deleteNoteQuery = `DELETE FROM notes WHERE id = ${noteId}`;
        pool.query(deleteNoteQuery, (deleteNoteError, deleteNoteResult) => {
          if (deleteNoteError) {
            console.log('error', deleteNoteError);
          } else {
            res.redirect('/');
          }
        });
      } else {
        res.send('You are not authorised to delete this post. ');
      }
    }
  });
});

// 3.POCE.6: Bird watching users
// displays the sign up form
app.get('/signup', (req, res) => {
  const { loggedIn } = req.cookies;
  res.render('sign-up', { loggedIn });
});

// submits the data in the sign up form
app.post('/signup', (req, res) => {
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });

  shaObj.update(req.body.password);

  const hashedPassword = shaObj.getHash('HEX');

  const newUserQuery = 'INSERT INTO users (email, password) VALUES ($1, $2)';
  const inputData = [req.body.email, hashedPassword];

  pool.query(newUserQuery, inputData, (newUserQueryError, newUserQueryResult) => {
    if (newUserQueryError) {
      console.log('error', newUserQueryError);
    } else {
      console.log(newUserQueryResult.rows);
      res.redirect('/login');
    }
  });
});

// displays the login form
app.get('/login', (req, res) => {
  const { loggedIn } = req.cookies;
  res.render('login', { loggedIn });
});

// submits the login data
app.post('/login', (req, res) => {
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
});

// logs the user out
app.delete('/logout', (req, res) => {
  res.clearCookie('loggedIn');
  res.clearCookie('userId');
  res.clearCookie('loggedInHash');
  res.redirect('/login');
});

// 3.POCE.7: Bird watching species
// renders a page where the user can create a new species
app.get('/species', (req, res) => {
  res.render('species-form');
});

// submits new species data into the database
app.post('/species', (req, res) => {
  const inputSpeciesQuery = 'INSERT INTO species (name, scientific_name) VALUES ($1, $2)';

  const inputData = [req.body.name, req.body.scientific_name];

  pool.query(inputSpeciesQuery, inputData, (inputSpeciesQueryError, inputSpeciesQueryResult) => {
    if (inputSpeciesQueryError) {
      console.log('error', inputSpeciesQueryError);
    } else {
      console.log('done');
      res.redirect('/');
    }
  });
});

// renders all the species
app.get('/species/all', (req, res) => {
  const getSpeciesInfo = 'SELECT * FROM species';

  pool.query(getSpeciesInfo, (getSpeciesInfoError, getSpeciesInfoResult) => {
    if (getSpeciesInfoError) {
      console.log('error', getSpeciesInfoError);
    } else {
      console.log(getSpeciesInfoResult.rows);
      const speciesInfo = getSpeciesInfoResult.rows;
      console.log('species info', speciesInfo);
      res.render('all-species', { speciesInfo });
    }
  });
});

// renders a page with a list of the user's entries
app.get('/users/:id', (req, res) => {
  const usersId = Number(req.params.id);

  const getUserEntriesQuery = `SELECT notes.id, notes.flock_size, notes.date, species.name FROM notes INNER JOIN species ON notes.species_id = species.id INNER JOIN users ON notes.user_id = users.id WHERE users.id = ${usersId}`;

  pool.query(getUserEntriesQuery, (getUserEntriesQueryError, getUserEntriesQueryResult) => {
    if (getUserEntriesQueryError) {
      console.log('error', getUserEntriesQueryError);
    } else {
      console.log(getUserEntriesQueryResult.rows);
      const userNotes = getUserEntriesQueryResult.rows;
      res.render('user-page', { userNotes });
    }
  });
});

// 3.POCE.8 : Bird watching behaviour
// displays all bird behaviours
app.get('/behaviour', (req, res) => {
  const allBehaviourQuery = 'SELECT * FROM behaviour';

  pool.query(allBehaviourQuery, (allBehaviourQueryError, allBehaviourQueryResult) => {
    if (allBehaviourQueryError) {
      console.log('error', allBehaviourQueryError);
    } else {
      const data = allBehaviourQueryResult.rows;
      console.log(data);
      res.render('behaviours', { data });
    }
  });
});

// displays list of notes that contain a particular behviour
app.get('/behaviour/:id', (req, res) => {
  const behaviourId = req.params.id;
  console.log(behaviourId);

  const behaviourQuery = `SELECT * FROM notes INNER JOIN notes_behaviour ON notes.id = notes_behaviour.notes_id INNER JOIN species ON notes.species_id = species.id WHERE behaviour_id = ${behaviourId}`;

  pool.query(behaviourQuery, (behaviourQueryError, behaviourQueryResult) => {
    if (behaviourQueryError) {
      console.log(behaviourQueryError);
    } else {
      console.log(behaviourQueryResult.rows);
      const data = behaviourQueryResult.rows;
      res.render('behaviour-notes', { data });
    }
  });
});

// 3.POCE.9: Bird watching comments
app.post('/note/:id/comment', (req, res) => {
  const { userId } = req.cookies;

  const notesId = req.params.id;
  console.log(notesId);
  const text = req.body.comment;
  console.log(text);

  const addCommentQuery = 'INSERT INTO comments (text, notes_id, user_id) VALUES ($1, $2, $3)';
  const inputData = [`'${text}'`, notesId, userId];

  pool.query(addCommentQuery, inputData, (addCommentQueryError, addCommentQueryResult) => {
    if (addCommentQueryError) {
      console.log('error', addCommentQueryError);
    } else {
      console.log('done');
      res.redirect('/');
    }
  });
});

app.listen(PORT);
