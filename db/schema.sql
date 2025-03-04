CREATE SCHEMA IF NOT EXISTS math_solver;

CREATE TABLE IF NOT EXISTS math_solver.users (
    id INT64 IDENTITY(1,1),
    email STRING NOT NULL,
    password_hash STRING NOT NULL,
    username STRING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS math_solver.solved_problems (
    id INT64 IDENTITY(1,1),
    user_id INT64,
    image_url STRING,
    problem_text STRING,
    solution STRING,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES math_solver.users(id)
); 
CREATE TABLE IF NOT EXISTS math_solver.sessions (
    id INT64 IDENTITY(1,1),
    user_id INT64 NOT NULL,
    token STRING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY(id),
    FOREIGN KEY(user_id) REFERENCES math_solver.users(id)
);