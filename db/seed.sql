-- data for question bank, rubrics and skills master list

-- skills master list
INSERT INTO skills (name, category) VALUES
  -- Languages
  ('JavaScript', 'language'), ('TypeScript', 'language'), ('Python', 'language'),
  ('Java', 'language'), ('C++', 'language'), ('C#', 'language'),
  ('Go', 'language'), ('Rust', 'language'), ('PHP', 'language'),
  ('Ruby', 'language'), ('Swift', 'language'), ('Kotlin', 'language'),
  -- Frameworks
  ('React', 'framework'), ('Vue.js', 'framework'), ('Angular', 'framework'),
  ('Node.js', 'framework'), ('Express.js', 'framework'), ('Django', 'framework'),
  ('Flask', 'framework'), ('Spring Boot', 'framework'), ('Laravel', 'framework'),
  ('Next.js', 'framework'), ('NestJS', 'framework'),
  -- Databases
  ('PostgreSQL', 'database'), ('MySQL', 'database'), ('MongoDB', 'database'),
  ('Redis', 'database'), ('SQLite', 'database'), ('Cassandra', 'database'),
  ('Elasticsearch', 'database'),
  -- Tools / DevOps
  ('Git', 'tool'), ('Docker', 'tool'), ('Kubernetes', 'tool'),
  ('AWS', 'tool'), ('Azure', 'tool'), ('GCP', 'tool'),
  ('Jenkins', 'tool'), ('GitHub Actions', 'tool'), ('Linux', 'tool'), ('Nginx', 'tool'),
  -- Concepts
  ('REST API', 'concept'), ('GraphQL', 'concept'), ('Microservices', 'concept'),
  ('CI/CD', 'concept'), ('Agile', 'concept'), ('Scrum', 'concept'),
  ('TDD', 'concept'), ('OOP', 'concept'), ('MVC', 'concept'),
  ('Data Structures', 'concept'), ('Algorithms', 'concept'),
  ('System Design', 'concept'), ('Design Patterns', 'concept'),
  -- Soft Skills
  ('Communication', 'soft_skill'), ('Problem Solving', 'soft_skill'),
  ('Teamwork', 'soft_skill'), ('Leadership', 'soft_skill'),
  ('Time Management', 'soft_skill')
ON CONFLICT (name) DO NOTHING;

-- generic questions
-- Data Structures & Algorithms
INSERT INTO questions (text, type, category, difficulty, hint, is_generic) VALUES
(
  'Explain the difference between a stack and a queue. When would you use each?',
  'technical', 'Data Structures', 'easy',
  'LIFO vs FIFO, real-world examples (call stack, task queues), time complexity of operations',
  TRUE
),
(
  'What is a hash table and how does it handle collisions? What is the average time complexity for lookup?',
  'technical', 'Data Structures', 'medium',
  'Hash function, chaining vs open addressing, O(1) average case, O(n) worst case',
  TRUE
),
(
  'Explain Big O notation. What is the time complexity of binary search and why?',
  'technical', 'Algorithms', 'easy',
  'Asymptotic analysis, O(log n) for binary search, sorted array requirement, divide and conquer',
  TRUE
),
(
  'How does a binary search tree (BST) work? What are its advantages and disadvantages?',
  'technical', 'Data Structures', 'medium',
  'Left < root < right property, O(log n) average search, O(n) worst case (unbalanced), self-balancing trees',
  TRUE
),
(
  'Describe the difference between depth-first search (DFS) and breadth-first search (BFS). When would you prefer one over the other?',
  'technical', 'Algorithms', 'medium',
  'DFS uses stack/recursion, BFS uses queue, DFS for path-finding/cycle detection, BFS for shortest path',
  TRUE
),

-- System Design
(
  'How would you design a URL shortener service like bit.ly? Walk through your architecture.',
  'technical', 'System Design', 'hard',
  'Hash function, database schema, redirect logic, caching (Redis), scaling, analytics, collision handling',
  TRUE
),
(
  'Explain the CAP theorem and what trade-offs it imposes on distributed systems.',
  'technical', 'System Design', 'hard',
  'Consistency, Availability, Partition Tolerance — can only guarantee 2 of 3, CP vs AP systems, examples',
  TRUE
),
(
  'What strategies would you use to scale a web application that is experiencing high traffic?',
  'technical', 'System Design', 'hard',
  'Horizontal scaling, load balancing, caching, CDN, database read replicas, message queues, microservices',
  TRUE
),

-- APIs & Web
(
  'What is the difference between REST and GraphQL? What are the trade-offs of each?',
  'technical', 'APIs', 'medium',
  'Over-fetching/under-fetching, fixed endpoints vs flexible queries, N+1 problem, caching differences',
  TRUE
),
(
  'Explain how HTTP works. What happens when you type a URL into a browser and press Enter?',
  'technical', 'General CS', 'easy',
  'DNS lookup, TCP handshake, HTTP request/response, TLS, server processing, rendering',
  TRUE
),
(
  'What are the HTTP status code categories and give examples of each?',
  'technical', 'APIs', 'easy',
  '1xx informational, 2xx success, 3xx redirect, 4xx client error, 5xx server error — specific examples',
  TRUE
),

-- Databases
(
  'Explain database indexing. How do indexes improve query performance and what are the trade-offs?',
  'technical', 'Databases', 'medium',
  'B-tree structure, faster reads, slower writes, storage overhead, when NOT to index, covering indexes',
  TRUE
),
(
  'What is the difference between SQL and NoSQL databases? When would you choose one over the other?',
  'technical', 'Databases', 'medium',
  'Schema vs schemaless, ACID vs BASE, scaling patterns, use cases — relational data vs document/key-value',
  TRUE
),
(
  'Explain database transactions and ACID properties.',
  'technical', 'Databases', 'medium',
  'Atomicity, Consistency, Isolation, Durability — each with concrete examples, isolation levels',
  TRUE
),

-- OOP & Design Patterns
(
  'Explain the four pillars of Object-Oriented Programming with examples.',
  'technical', 'OOP', 'easy',
  'Encapsulation, Abstraction, Inheritance, Polymorphism — real-world and code examples for each',
  TRUE
),
(
  'Describe the SOLID principles and why they matter.',
  'technical', 'Design Patterns', 'medium',
  'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion',
  TRUE
),

-- Behavioral
(
  'Tell me about a time you had to debug a difficult problem. Walk me through your process.',
  'behavioral', 'Problem Solving', 'medium',
  'STAR method, systematic debugging approach, tools used, lessons learned, outcome',
  TRUE
),
(
  'Describe a situation where you had a disagreement with a teammate. How did you resolve it?',
  'behavioral', 'Teamwork', 'medium',
  'STAR method, communication skills, empathy, reaching compromise, outcome, what you learned',
  TRUE
),
(
  'Tell me about a project you are most proud of. What was your contribution and what challenges did you face?',
  'behavioral', 'Leadership', 'easy',
  'Clear project description, specific personal contributions, concrete challenges, measurable outcomes',
  TRUE
),
(
  'How do you prioritize tasks when you have multiple deadlines and limited time?',
  'behavioral', 'Time Management', 'easy',
  'Framework for prioritization (impact/effort, urgency/importance), communication with stakeholders, examples',
  TRUE
);

-- rubrics for questions
-- Q1: Stack vs Queue
WITH q AS (SELECT id FROM questions WHERE text LIKE 'Explain the difference between a stack and a queue%')
INSERT INTO rubrics (question_id, criterion, keywords, weight, order_index)
SELECT question_id, criterion, keywords::jsonb, weight, order_index FROM (VALUES
  ((SELECT id FROM q), 'Correctly defines LIFO (Last In First Out) for stack', '["lifo","last in","first out","stack"]', 1.0, 1),
  ((SELECT id FROM q), 'Correctly defines FIFO (First In First Out) for queue', '["fifo","first in","first out","queue"]', 1.0, 2),
  ((SELECT id FROM q), 'Provides a real-world example for stack (call stack, undo, browser history)', '["call stack","undo","browser history","recursion","backtracking"]', 0.8, 3),
  ((SELECT id FROM q), 'Provides a real-world example for queue (print queue, task scheduling, BFS)', '["print queue","task queue","scheduling","bfs","breadth"]', 0.8, 4),
  ((SELECT id FROM q), 'Mentions time complexity of push/pop and enqueue/dequeue (O(1))', '["o(1)","constant","time complexity"]', 0.7, 5)
) AS v(question_id, criterion, keywords, weight, order_index);

-- Q3: Big O
WITH q AS (SELECT id FROM questions WHERE text LIKE 'Explain Big O notation%')
INSERT INTO rubrics (question_id, criterion, keywords, weight, order_index)
SELECT question_id, criterion, keywords::jsonb, weight, order_index FROM (VALUES
  ((SELECT id FROM q), 'Explains Big O as a measure of worst-case time/space growth', '["worst case","growth","asymptotic","rate","upper bound"]', 1.0, 1),
  ((SELECT id FROM q), 'States O(log n) for binary search', '["log n","o(log","logarithmic"]', 1.0, 2),
  ((SELECT id FROM q), 'Explains why it is O(log n) — halving the search space each step', '["halv","divide","half","each step","reduces"]', 1.0, 3),
  ((SELECT id FROM q), 'Mentions that the array must be sorted', '["sorted","sort","order"]', 0.8, 4),
  ((SELECT id FROM q), 'Gives other Big O examples for context (O(1), O(n), O(n²))', '["o(1)","o(n)","o(n²)","o(n^2)","constant","linear","quadratic"]', 0.6, 5)
) AS v(question_id, criterion, keywords, weight, order_index);

-- Q9: REST vs GraphQL
WITH q AS (SELECT id FROM questions WHERE text LIKE 'What is the difference between REST and GraphQL%')
INSERT INTO rubrics (question_id, criterion, keywords, weight, order_index)
SELECT question_id, criterion, keywords::jsonb, weight, order_index FROM (VALUES
  ((SELECT id FROM q), 'Explains REST fixed endpoints vs GraphQL single endpoint with flexible queries', '["endpoint","flexible","query","fixed","single"]', 1.0, 1),
  ((SELECT id FROM q), 'Mentions over-fetching and under-fetching problems with REST', '["over-fetch","under-fetch","overfetch","underfetch","too much","too little"]', 1.0, 2),
  ((SELECT id FROM q), 'Mentions the N+1 query problem in GraphQL', '["n+1","n plus 1","multiple requests","resolver"]', 0.8, 3),
  ((SELECT id FROM q), 'Discusses caching differences (REST easier to cache at HTTP level)', '["cache","caching","http cache","cdn"]', 0.7, 4),
  ((SELECT id FROM q), 'Gives a real use case where one would be preferred over the other', '["use case","prefer","choose","when","mobile","complex"]', 0.6, 5)
) AS v(question_id, criterion, keywords, weight, order_index);

-- Q17: Debugging behavioral
WITH q AS (SELECT id FROM questions WHERE text LIKE 'Tell me about a time you had to debug%')
INSERT INTO rubrics (question_id, criterion, keywords, weight, order_index)
SELECT question_id, criterion, keywords::jsonb, weight, order_index FROM (VALUES
  ((SELECT id FROM q), 'Uses the STAR method (Situation, Task, Action, Result)', '["situation","task","action","result","star"]', 0.9, 1),
  ((SELECT id FROM q), 'Describes the specific bug or problem clearly', '["bug","error","issue","problem","crash","failure"]', 1.0, 2),
  ((SELECT id FROM q), 'Explains systematic debugging approach (logs, breakpoints, isolation)', '["log","console","breakpoint","isolat","systematic","step by step","narrow down"]', 1.0, 3),
  ((SELECT id FROM q), 'Mentions tools or methods used', '["debugger","console.log","print","tools","stack trace","profil"]', 0.7, 4),
  ((SELECT id FROM q), 'States the outcome and what was learned', '["resolved","fixed","learned","lesson","outcome","result"]', 0.8, 5)
) AS v(question_id, criterion, keywords, weight, order_index);