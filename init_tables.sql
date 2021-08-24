DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS behaviours CASCADE;
DROP TABLE IF EXISTS notes_behaviours CASCADE;
DROP TABLE IF EXISTS species CASCADE;
DROP TABLE IF EXISTS comments CASCADE;

CREATE TABLE IF NOT EXISTS users (
          id                SERIAL PRIMARY KEY,
          username          TEXT NOT NULL,
          email             TEXT NOT NULL,
          password          TEXT NOT NULL
          );

CREATE TABLE IF NOT EXISTS species (
          id                SERIAL PRIMARY KEY,
          name              TEXT,
          scientific_name   TEXT
          );

CREATE TABLE IF NOT EXISTS notes (
          id                SERIAL PRIMARY KEY,
          user_id           INTEGER REFERENCES users(id),
          date              DATE NOT NULL DEFAULT CURRENT_DATE,
          species_id        INTEGER REFERENCES species(id),
          flock_size        INTEGER,
          summary           TEXT
          );

CREATE TABLE IF NOT EXISTS behaviours (
          id                SERIAL PRIMARY KEY,
          behaviour         TEXT
          );

CREATE TABLE IF NOT EXISTS notes_behaviours (
          id                SERIAL PRIMARY KEY,
          notes_id          INTEGER REFERENCES notes(id),
          behaviour_id      INTEGER REFERENCES behaviours(id)
          );

CREATE TABLE IF NOT EXISTS comments (
          id                SERIAL PRIMARY KEY,
          text              TEXT,
          notes_id          INTEGER REFERENCES notes(id),
          user_id           INTEGER REFERENCES users(id)
          );

INSERT INTO species (name, scientific_name) VALUES ('Wandering Whistling Duckling Duck', 'Dendrocygna arcuata'), ('Lesser Whistling Duck', 'Dendrocygna javanica'), ('Cotton Pygmy Goose', 'ettapus coromandelianus'), ('Gadwall', 'Anas strepera'), ('Eurasian Wigeon', 'Anas penelope'), ('Northern Shoveler','Anas clypeata'), ('Northern Pintail', 'Anas acuta'), ('Garganey', 'Anas querquedula'), ('Eurasian Teal', 'Anas crecca'), ('Tufted Duck', 'Aythya fuligula'), ('Red Junglefowl', 'Gallus gallus');

INSERT INTO users (username, email, password) VALUES ('Mister_T', 'tintin@neopets.com', 'supersaiyan');

INSERT INTO behaviours (behaviour) VALUES ('Bathing'), ('Feeding'), ('Walking'), ('Resting'), ('Flocking'), ('Climbing Tree'), ('Drinking'), ('Singing'), ('Preening'), ('Hovering');

INSERT INTO notes (user_id, species_id, flock_size, summary)
        VALUES    (1,           1,          10,       'Saw some birdies yo'),
                (1,           4,          2,       '2 birds sitting in a tree');
