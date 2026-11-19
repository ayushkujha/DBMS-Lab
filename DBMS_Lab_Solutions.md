# DBMS Lab – Question Bank Solutions

Sets 1 to 8: SQL queries with sample output, and ER diagrams.

## Notes

- Part A has the CREATE TABLE statements (a) and sample records (b) for each schema. Sets sharing a schema use the same tables and records.
- Syntax is MySQL / ANSI SQL. For Oracle: use `NUMBER` instead of `INT`, `VARCHAR2` instead of `VARCHAR`, and write `ALTER TABLE ... ADD (column type)` without the `COLUMN` keyword.
- Sample output was produced by running the statements on a test database loaded with the Part A records, formatted like the MySQL console. Set 2(d) uses `ANY`; the test engine does not support it, so its output comes from the equivalent query with `MIN()`.
- Sample records are made up. Data types and constraints for the Road Way Travel System are assumed, because the question lists column names only.
- ER diagrams are in Chen notation (rectangle = entity, ellipse = attribute, underlined = primary key, diamond = relationship, 1/N/M = cardinality). They are PNG files: keep them in the same folder as this .md file.

| Set | SQL schema | ER diagram |
|---|---|---|
| 1 | College Database | [Library Management System](#figure-1) |
| 2 | College Database | [Hospital Management System](#figure-2) |
| 3 | Sailors Database | [University Management System](#figure-3) |
| 4 | Sailors Database | [Roadway Travel System](#figure-4) |
| 5 | client_master / product_master | [Hospital Management System](#figure-2) |
| 6 | client_master / product_master | [University Management System](#figure-3) |
| 7 | Road Way Travel System | [University Management System](#figure-3) |
| 8 | Road Way Travel System | [Hospital Management System](#figure-2) |

---

# Part A – Schemas and Sample Records

## Schema A – College Database (Sets 1 and 2)

*Source schema has the typo 'Coutrse_id' in Course_Faculty; it is written as Course_id so the foreign key to Courses works.*

### (a) CREATE TABLE

```sql
CREATE TABLE Students (
    Student_ID    INT PRIMARY KEY,
    Student_name  VARCHAR(50) NOT NULL,
    Branch        VARCHAR(20) NOT NULL,
    Year          INT CHECK (Year BETWEEN 1 AND 4),
    Email         VARCHAR(60) UNIQUE,
    Phone         VARCHAR(15)
);

CREATE TABLE Courses (
    Course_id     INT PRIMARY KEY,
    Course_name   VARCHAR(50) NOT NULL,
    Credits       INT NOT NULL CHECK (Credits > 0)
);

CREATE TABLE Faculty (
    Faculty_id    INT PRIMARY KEY,
    Faculty_Name  VARCHAR(50) NOT NULL,
    Department    VARCHAR(30)
);

CREATE TABLE Enrollment (
    Enrollment_ID   INT PRIMARY KEY,
    Student_ID      INT NOT NULL,
    Course_id       INT NOT NULL,
    Enrollment_Date DATE,
    Grade           VARCHAR(2),
    FOREIGN KEY (Student_ID) REFERENCES Students(Student_ID),
    FOREIGN KEY (Course_id)  REFERENCES Courses(Course_id),
    UNIQUE (Student_ID, Course_id)
);

CREATE TABLE Course_Faculty (
    Course_id   INT,
    Faculty_id  INT,
    PRIMARY KEY (Course_id, Faculty_id),
    FOREIGN KEY (Course_id)  REFERENCES Courses(Course_id),
    FOREIGN KEY (Faculty_id) REFERENCES Faculty(Faculty_id)
);
```

### (b) INSERT – sample records

```sql
INSERT INTO Students VALUES (101, 'Arjun Reddy',  'CSE', 3, 'arjun@vjit.ac.in',  '9876500001');
INSERT INTO Students VALUES (102, 'Sneha Rao',    'ECE', 3, 'sneha@vjit.ac.in',  '9876500002');
INSERT INTO Students VALUES (103, 'Kiran Kumar',  'CSE', 2, 'kiran@vjit.ac.in',  '9876500003');
INSERT INTO Students VALUES (104, 'Divya Sri',    'IT',  3, 'divya@vjit.ac.in',  '9876500004');
INSERT INTO Students VALUES (105, 'Rohit Verma',  'CSE', 3, 'rohit@vjit.ac.in',  '9876500005');

INSERT INTO Courses VALUES (201, 'DBMS',                4);
INSERT INTO Courses VALUES (202, 'Data Structures',     4);
INSERT INTO Courses VALUES (203, 'Operating Systems',   3);
INSERT INTO Courses VALUES (204, 'Computer Networks',   3);
INSERT INTO Courses VALUES (205, 'Python Programming',  2);

INSERT INTO Faculty VALUES (301, 'Dr. Meena Iyer',    'CSE');
INSERT INTO Faculty VALUES (302, 'Prof. Suresh Babu', 'CSE');
INSERT INTO Faculty VALUES (303, 'Dr. Anitha Rao',    'ECE');
INSERT INTO Faculty VALUES (304, 'Prof. Rajesh Nair', 'IT');
INSERT INTO Faculty VALUES (305, 'Dr. Lakshmi Devi',  'Mathematics');

INSERT INTO Enrollment VALUES (1, 101, 201, DATE '2026-07-20', 'A');
INSERT INTO Enrollment VALUES (2, 101, 202, DATE '2026-07-20', 'B');
INSERT INTO Enrollment VALUES (3, 102, 201, DATE '2026-07-21', 'A');
INSERT INTO Enrollment VALUES (4, 103, 203, DATE '2026-07-21', 'A');
INSERT INTO Enrollment VALUES (5, 104, 204, DATE '2026-07-22', 'C');
INSERT INTO Enrollment VALUES (6, 105, 201, DATE '2026-07-22', 'B');

INSERT INTO Course_Faculty VALUES (201, 301);
INSERT INTO Course_Faculty VALUES (202, 302);
INSERT INTO Course_Faculty VALUES (203, 302);
INSERT INTO Course_Faculty VALUES (204, 303);
INSERT INTO Course_Faculty VALUES (205, 304);
```

## Schema B – Sailors Database (Sets 3 and 4)

### (a) CREATE TABLE

```sql
CREATE TABLE Sailors (
    sid     INT PRIMARY KEY,
    sname   VARCHAR(30) NOT NULL,
    rating  INT CHECK (rating BETWEEN 1 AND 10),
    age     REAL CHECK (age > 0)
);

CREATE TABLE Boats (
    bid     INT PRIMARY KEY,
    bname   VARCHAR(30) NOT NULL,
    color   VARCHAR(10)
);

CREATE TABLE Reserves (
    sid   INT,
    bid   INT,
    day   DATE,
    PRIMARY KEY (sid, bid, day),
    FOREIGN KEY (sid) REFERENCES Sailors(sid),
    FOREIGN KEY (bid) REFERENCES Boats(bid)
);
```

### (b) INSERT – sample records

```sql
INSERT INTO Sailors VALUES (22, 'Dustin',  7, 45.0);
INSERT INTO Sailors VALUES (29, 'Brutus',  1, 33.0);
INSERT INTO Sailors VALUES (31, 'Lubber',  8, 55.5);
INSERT INTO Sailors VALUES (58, 'Rusty',  10, 35.0);
INSERT INTO Sailors VALUES (64, 'Horatio', 7, 35.0);
INSERT INTO Sailors VALUES (71, 'Zorba',  10, 16.0);

INSERT INTO Boats VALUES (101, 'Interlake', 'blue');
INSERT INTO Boats VALUES (102, 'Interlake', 'red');
INSERT INTO Boats VALUES (103, 'Clipper',   'green');
INSERT INTO Boats VALUES (104, 'Marine',    'red');
INSERT INTO Boats VALUES (105, 'Voyager',   'blue');

INSERT INTO Reserves VALUES (22, 101, DATE '2026-10-10');
INSERT INTO Reserves VALUES (22, 102, DATE '2026-10-10');
INSERT INTO Reserves VALUES (22, 103, DATE '2026-08-10');
INSERT INTO Reserves VALUES (31, 103, DATE '2026-06-11');
INSERT INTO Reserves VALUES (58, 103, DATE '2026-11-12');
INSERT INTO Reserves VALUES (64, 104, DATE '2026-09-05');
```

## Schema C – client_master and product_master (Sets 5 and 6)

*Source schema fixes: client_no varchar() has no length, so VARCHAR(10) is used; 'pin code' contains a space, so the column is pincode; NUMBER(n) is Oracle syntax, so INT is used (use NUMBER(n) on Oracle). The column name reoder_lvl is kept exactly as in the source.*

### (a) CREATE TABLE

```sql
CREATE TABLE client_master (
    client_no  VARCHAR(10) PRIMARY KEY,
    name       VARCHAR(20) NOT NULL,
    city       VARCHAR(15),
    pincode    INT,
    state      VARCHAR(20),
    bal_due    INT DEFAULT 0
);

CREATE TABLE product_master (
    product_no     VARCHAR(10) PRIMARY KEY,
    description    VARCHAR(20) NOT NULL,
    profit_percent DECIMAL(5,2),
    unit_measure   VARCHAR(8),
    qty_on_hand    INT CHECK (qty_on_hand >= 0),
    reoder_lvl     INT,
    selling_price  INT CHECK (selling_price >= 0),
    cost_price     INT CHECK (cost_price >= 0)
);
```

### (b) INSERT – sample records

```sql
INSERT INTO client_master VALUES ('0001', 'Ivan Bayross',     'Bombay',    400054, 'Maharashtra', 15000);
INSERT INTO client_master VALUES ('0002', 'Vandana Saitwal',  'Madras',    780001, 'Tamil Nadu',  0);
INSERT INTO client_master VALUES ('0003', 'Pramada Jaguste',  'Delhi',     110001, 'Delhi',       5000);
INSERT INTO client_master VALUES ('0004', 'Basu Navindgi',    'Bombay',    400057, 'Maharashtra', 0);
INSERT INTO client_master VALUES ('0005', 'Ravi Sreedharan',  'Bangalore', 560001, 'Karnataka',   2000);

INSERT INTO product_master VALUES ('P00001', 'Keyboard',     12.50, 'Piece', 100, 20,  500,  444);
INSERT INTO product_master VALUES ('P00002', 'Mouse',        15.00, 'Piece', 150, 30,  350,  304);
INSERT INTO product_master VALUES ('P00003', 'Monitor',      10.00, 'Piece',  40, 10, 3200, 2909);
INSERT INTO product_master VALUES ('P00004', 'Hard Disk 1TB', 8.00, 'Piece',  60, 15, 5000, 4630);
INSERT INTO product_master VALUES ('P00005', 'Printer',      10.00, 'Piece',  25,  5, 8500, 7727);
```

## Schema D – Road Way Travel System (Sets 7 and 8)

*The source gives column names only, so data types and constraints below are assumed. TIME columns suit MySQL/PostgreSQL; on Oracle use VARCHAR2 or TIMESTAMP.*

### (a) CREATE TABLE

```sql
CREATE TABLE Passenger (
    Passenger_ID  INT PRIMARY KEY,
    Name          VARCHAR(50) NOT NULL,
    Age           INT CHECK (Age > 0),
    Gender        CHAR(1) CHECK (Gender IN ('M','F','O')),
    Phone         VARCHAR(15),
    Email         VARCHAR(60) UNIQUE
);

CREATE TABLE Bus (
    Bus_ID      INT PRIMARY KEY,
    Bus_Number  VARCHAR(15) NOT NULL UNIQUE,
    Bus_Type    VARCHAR(20),
    Capacity    INT CHECK (Capacity > 0),
    Status      VARCHAR(15) DEFAULT 'Active'
);

CREATE TABLE Driver (
    Driver_ID       INT PRIMARY KEY,
    Driver_Name     VARCHAR(50) NOT NULL,
    License_Number  VARCHAR(20) NOT NULL UNIQUE,
    Phone           VARCHAR(15),
    Experience      INT CHECK (Experience >= 0)
);

CREATE TABLE Route (
    Route_ID     INT PRIMARY KEY,
    Source       VARCHAR(30) NOT NULL,
    Destination  VARCHAR(30) NOT NULL,
    Distance     INT CHECK (Distance > 0),
    Duration     VARCHAR(10)
);

CREATE TABLE Schedule (
    Schedule_ID     INT PRIMARY KEY,
    Bus_ID          INT NOT NULL,
    Route_ID        INT NOT NULL,
    Driver_ID       INT NOT NULL,
    Departure_Time  TIME,
    Arrival_Time    TIME,
    Travel_Date     DATE NOT NULL,
    FOREIGN KEY (Bus_ID)    REFERENCES Bus(Bus_ID),
    FOREIGN KEY (Route_ID)  REFERENCES Route(Route_ID),
    FOREIGN KEY (Driver_ID) REFERENCES Driver(Driver_ID)
);

CREATE TABLE Booking (
    Booking_ID      INT PRIMARY KEY,
    Passenger_ID    INT NOT NULL,
    Schedule_ID     INT NOT NULL,
    Booking_Date    DATE,
    Seat_Number     INT,
    Total_Fare      DECIMAL(8,2) CHECK (Total_Fare >= 0),
    Booking_Status  VARCHAR(15),
    FOREIGN KEY (Passenger_ID) REFERENCES Passenger(Passenger_ID),
    FOREIGN KEY (Schedule_ID)  REFERENCES Schedule(Schedule_ID),
    UNIQUE (Schedule_ID, Seat_Number)
);

CREATE TABLE Payment (
    Payment_ID      INT PRIMARY KEY,
    Booking_ID      INT NOT NULL,
    Payment_Date    DATE,
    Amount          DECIMAL(8,2) CHECK (Amount >= 0),
    Payment_Mode    VARCHAR(15),
    Payment_Status  VARCHAR(15),
    FOREIGN KEY (Booking_ID) REFERENCES Booking(Booking_ID)
);
```

### (b) INSERT – sample records

```sql
INSERT INTO Passenger VALUES (1, 'Ravi Teja',        28, 'M', '9876512340', 'ravi.teja@mail.com');
INSERT INTO Passenger VALUES (2, 'Anjali Sharma',    34, 'F', '9876512341', 'anjali.s@mail.com');
INSERT INTO Passenger VALUES (3, 'Mohammed Imran',   45, 'M', '9876512342', 'imran.m@mail.com');
INSERT INTO Passenger VALUES (4, 'Lakshmi Prasanna', 52, 'F', '9876512343', 'lakshmi.p@mail.com');
INSERT INTO Passenger VALUES (5, 'Karthik Naidu',    23, 'M', '9876512344', 'karthik.n@mail.com');

INSERT INTO Bus VALUES (1, 'TS09UA1234', 'Volvo AC Sleeper', 40, 'Active');
INSERT INTO Bus VALUES (2, 'TS08UB5678', 'Express',          52, 'Active');
INSERT INTO Bus VALUES (3, 'AP28TC9012', 'Deluxe',           45, 'Active');
INSERT INTO Bus VALUES (4, 'TS10UD3456', 'Super Luxury',     50, 'Maintenance');
INSERT INTO Bus VALUES (5, 'KA01AE7890', 'Mini',             30, 'Active');

INSERT INTO Driver VALUES (1, 'Ramesh Kumar',  'TS0920150012345', '9000000001', 12);
INSERT INTO Driver VALUES (2, 'Suresh Yadav',  'TS0820130054321', '9000000002', 15);
INSERT INTO Driver VALUES (3, 'Venkat Rao',    'AP2820180098765', '9000000003',  8);
INSERT INTO Driver VALUES (4, 'Mahesh Goud',   'TS1020120011223', '9000000004', 16);
INSERT INTO Driver VALUES (5, 'Prakash Shetty','KA0120190033445', '9000000005',  6);

INSERT INTO Route VALUES (1, 'Hyderabad', 'Bengaluru',  570, '10h 30m');
INSERT INTO Route VALUES (2, 'Hyderabad', 'Chennai',    630, '12h');
INSERT INTO Route VALUES (3, 'Hyderabad', 'Vijayawada',275, '5h');
INSERT INTO Route VALUES (4, 'Hyderabad', 'Mumbai',     710, '13h');
INSERT INTO Route VALUES (5, 'Bengaluru', 'Chennai',    350, '6h');

INSERT INTO Schedule VALUES (1, 1, 1, 1, '21:00:00', '07:30:00', DATE '2026-12-05');
INSERT INTO Schedule VALUES (2, 2, 2, 2, '20:00:00', '08:00:00', DATE '2026-12-06');
INSERT INTO Schedule VALUES (3, 3, 3, 3, '06:00:00', '11:00:00', DATE '2026-12-07');
INSERT INTO Schedule VALUES (4, 4, 4, 4, '18:00:00', '07:00:00', DATE '2026-12-08');
INSERT INTO Schedule VALUES (5, 5, 5, 5, '07:00:00', '13:00:00', DATE '2026-12-09');

INSERT INTO Booking VALUES (1, 1, 1, DATE '2026-11-20', 12,  850.00, 'Confirmed');
INSERT INTO Booking VALUES (2, 2, 2, DATE '2026-11-21',  5, 1200.00, 'Confirmed');
INSERT INTO Booking VALUES (3, 3, 3, DATE '2026-11-22', 18,  950.00, 'Confirmed');
INSERT INTO Booking VALUES (4, 4, 4, DATE '2026-11-23', 22,  700.00, 'Pending');
INSERT INTO Booking VALUES (5, 1, 5, DATE '2026-11-24',  9, 1100.00, 'Confirmed');

INSERT INTO Payment VALUES (1, 1, DATE '2026-11-20',  850.00, 'UPI',  'Paid');
INSERT INTO Payment VALUES (2, 2, DATE '2026-11-21', 1200.00, 'Card', 'Paid');
INSERT INTO Payment VALUES (3, 3, DATE '2026-11-22',  950.00, 'Cash', 'Paid');
INSERT INTO Payment VALUES (4, 4, DATE '2026-11-23',  700.00, 'UPI',  'Pending');
INSERT INTO Payment VALUES (5, 5, DATE '2026-11-24', 1100.00, 'Card', 'Paid');
```

---

# Part B – Set-wise Solutions

## Set 1

**Question 1.** College Database. Parts (a) and (b): see Schema A – College Database in Part A.

### (c) Display all CSE students.

```sql
SELECT * FROM Students
WHERE Branch = 'CSE';
```

Output:

```text
+------------+--------------+--------+------+------------------+------------+
| Student_ID | Student_name | Branch | Year | Email            | Phone      |
+------------+--------------+--------+------+------------------+------------+
| 101        | Arjun Reddy  | CSE    | 3    | arjun@vjit.ac.in | 9876500001 |
| 103        | Kiran Kumar  | CSE    | 2    | kiran@vjit.ac.in | 9876500003 |
| 105        | Rohit Verma  | CSE    | 3    | rohit@vjit.ac.in | 9876500005 |
+------------+--------------+--------+------+------------------+------------+
3 rows in set
```

### (d) Create a view containing only 3rd-year students.

```sql
CREATE VIEW Third_Year_Students AS
SELECT * FROM Students
WHERE Year = 3;

SELECT * FROM Third_Year_Students;
```

Output:

```text
+------------+--------------+--------+------+------------------+------------+
| Student_ID | Student_name | Branch | Year | Email            | Phone      |
+------------+--------------+--------+------+------------------+------------+
| 101        | Arjun Reddy  | CSE    | 3    | arjun@vjit.ac.in | 9876500001 |
| 102        | Sneha Rao    | ECE    | 3    | sneha@vjit.ac.in | 9876500002 |
| 104        | Divya Sri    | IT     | 3    | divya@vjit.ac.in | 9876500004 |
| 105        | Rohit Verma  | CSE    | 3    | rohit@vjit.ac.in | 9876500005 |
+------------+--------------+--------+------+------------------+------------+
4 rows in set
```

### (e) Find the Grade-A count per course.

```sql
SELECT c.Course_id, c.Course_name, COUNT(*) AS Grade_A_Count
FROM Enrollment e
JOIN Courses c ON c.Course_id = e.Course_id
WHERE e.Grade = 'A'
GROUP BY c.Course_id, c.Course_name;
```

Output:

```text
+-----------+-------------------+---------------+
| Course_id | Course_name       | Grade_A_Count |
+-----------+-------------------+---------------+
| 201       | DBMS              | 2             |
| 203       | Operating Systems | 1             |
+-----------+-------------------+---------------+
2 rows in set
```

### (f) Find courses having at least one enrollment using EXISTS.

```sql
SELECT *
FROM Courses c
WHERE EXISTS (SELECT 1
              FROM Enrollment e
              WHERE e.Course_id = c.Course_id);
```

Output:

```text
+-----------+-------------------+---------+
| Course_id | Course_name       | Credits |
+-----------+-------------------+---------+
| 201       | DBMS              | 4       |
| 202       | Data Structures   | 4       |
| 203       | Operating Systems | 3       |
| 204       | Computer Networks | 3       |
+-----------+-------------------+---------+
4 rows in set
```

**Question 2.** Draw the ER diagram for the Library Management System. See [Figure 1](#figure-1).

## Set 2

**Question 1.** College Database. Parts (a) and (b): see Schema A – College Database in Part A.

### (c) Display all CSE students.

```sql
SELECT * FROM Students
WHERE Branch = 'CSE';
```

Output:

```text
+------------+--------------+--------+------+------------------+------------+
| Student_ID | Student_name | Branch | Year | Email            | Phone      |
+------------+--------------+--------+------+------------------+------------+
| 101        | Arjun Reddy  | CSE    | 3    | arjun@vjit.ac.in | 9876500001 |
| 103        | Kiran Kumar  | CSE    | 2    | kiran@vjit.ac.in | 9876500003 |
| 105        | Rohit Verma  | CSE    | 3    | rohit@vjit.ac.in | 9876500005 |
+------------+--------------+--------+------+------------------+------------+
3 rows in set
```

### (d) Find courses with Credits greater than ANY 3-credit course.

```sql
SELECT *
FROM Courses
WHERE Credits > ANY (SELECT Credits
                     FROM Courses
                     WHERE Credits = 3);
```

Output:

```text
+-----------+-----------------+---------+
| Course_id | Course_name     | Credits |
+-----------+-----------------+---------+
| 201       | DBMS            | 4       |
| 202       | Data Structures | 4       |
+-----------+-----------------+---------+
2 rows in set
```

### (e) Add Date_of_Birth to Students.

```sql
ALTER TABLE Students ADD COLUMN Date_of_Birth DATE;

SELECT Student_ID, Student_name, Date_of_Birth FROM Students;
```

Output:

```text
+------------+--------------+---------------+
| Student_ID | Student_name | Date_of_Birth |
+------------+--------------+---------------+
| 101        | Arjun Reddy  | NULL          |
| 102        | Sneha Rao    | NULL          |
| 103        | Kiran Kumar  | NULL          |
| 104        | Divya Sri    | NULL          |
| 105        | Rohit Verma  | NULL          |
+------------+--------------+---------------+
5 rows in set
```

### (f) Update an enrollment Grade.

```sql
UPDATE Enrollment
SET Grade = 'A'
WHERE Enrollment_ID = 2;

SELECT * FROM Enrollment WHERE Enrollment_ID = 2;
```

Output:

```text
+---------------+------------+-----------+-----------------+-------+
| Enrollment_ID | Student_ID | Course_id | Enrollment_Date | Grade |
+---------------+------------+-----------+-----------------+-------+
| 2             | 101        | 202       | 2026-07-20      | A     |
+---------------+------------+-----------+-----------------+-------+
1 row in set
```

**Question 2.** Draw the ER diagram for the Hospital Management System. See [Figure 2](#figure-2).

## Set 3

**Question 1.** Sailors Database. Parts (a) and (b): see Schema B – Sailors Database in Part A.

### (c) Find the names of sailors who have reserved boat no 103.

```sql
SELECT DISTINCT s.sname
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
WHERE r.bid = 103;
```

Output:

```text
+--------+
| sname  |
+--------+
| Dustin |
| Lubber |
| Rusty  |
+--------+
3 rows in set
```

### (d) Find the sailors with the highest rating.

```sql
SELECT *
FROM Sailors
WHERE rating = (SELECT MAX(rating) FROM Sailors);
```

Output:

```text
+-----+-------+--------+------+
| sid | sname | rating | age  |
+-----+-------+--------+------+
| 58  | Rusty | 10     | 35.0 |
| 71  | Zorba | 10     | 16.0 |
+-----+-------+--------+------+
2 rows in set
```

### (e) List all the sailors and boats who have reserved.

```sql
SELECT s.sid, s.sname, b.bid, b.bname, r.day
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
JOIN Boats b    ON b.bid = r.bid;
```

Output:

```text
+-----+---------+-----+-----------+------------+
| sid | sname   | bid | bname     | day        |
+-----+---------+-----+-----------+------------+
| 22  | Dustin  | 101 | Interlake | 2026-10-10 |
| 22  | Dustin  | 102 | Interlake | 2026-10-10 |
| 22  | Dustin  | 103 | Clipper   | 2026-08-10 |
| 31  | Lubber  | 103 | Clipper   | 2026-06-11 |
| 58  | Rusty   | 103 | Clipper   | 2026-11-12 |
| 64  | Horatio | 104 | Marine    | 2026-09-05 |
+-----+---------+-----+-----------+------------+
6 rows in set
```

### (f) Find the sailors who are eligible to vote (age 18 or above).

```sql
SELECT *
FROM Sailors
WHERE age >= 18;
```

Output:

```text
+-----+---------+--------+------+
| sid | sname   | rating | age  |
+-----+---------+--------+------+
| 22  | Dustin  | 7      | 45.0 |
| 29  | Brutus  | 1      | 33.0 |
| 31  | Lubber  | 8      | 55.5 |
| 58  | Rusty   | 10     | 35.0 |
| 64  | Horatio | 7      | 35.0 |
+-----+---------+--------+------+
5 rows in set
```

**Question 2.** Draw the ER diagram for the University Management System. See [Figure 3](#figure-3).

## Set 4

**Question 1.** Sailors Database. Parts (a) and (b): see Schema B – Sailors Database in Part A.

### (c) Find the names of sailors who have reserved a red and a green boat.

```sql
SELECT s.sname
FROM Sailors s
WHERE s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'red')
  AND s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'green');
```

Output:

```text
+--------+
| sname  |
+--------+
| Dustin |
+--------+
1 row in set
```

### (d) Find the average age of sailors for each rating level that has at least two sailors.

```sql
SELECT rating, AVG(age) AS avg_age
FROM Sailors
GROUP BY rating
HAVING COUNT(*) >= 2;
```

Output:

```text
+--------+---------+
| rating | avg_age |
+--------+---------+
| 7      | 40.0    |
| 10     | 25.5    |
+--------+---------+
2 rows in set
```

### (e) Count the number of reservations.

```sql
SELECT COUNT(*) AS Total_Reservations
FROM Reserves;
```

Output:

```text
+--------------------+
| Total_Reservations |
+--------------------+
| 6                  |
+--------------------+
1 row in set
```

### (f) Find the sid of sailors who have reserved at least one boat.

```sql
SELECT DISTINCT sid
FROM Reserves;
```

Output:

```text
+-----+
| sid |
+-----+
| 22  |
| 31  |
| 58  |
| 64  |
+-----+
4 rows in set
```

**Question 2.** Draw the ER diagram for the Roadway Travel System. See [Figure 4](#figure-4).

## Set 5

**Question 1.** client_master / product_master. Parts (a) and (b): see Schema C – client_master and product_master in Part A.

### (c) Find out the names of all the clients.

```sql
SELECT name FROM client_master;
```

Output:

```text
+-----------------+
| name            |
+-----------------+
| Ivan Bayross    |
| Vandana Saitwal |
| Pramada Jaguste |
| Basu Navindgi   |
| Ravi Sreedharan |
+-----------------+
5 rows in set
```

### (d) Display the information for client no 0001 and 0002.

```sql
SELECT *
FROM client_master
WHERE client_no IN ('0001', '0002');
```

Output:

```text
+-----------+-----------------+--------+---------+-------------+---------+
| client_no | name            | city   | pincode | state       | bal_due |
+-----------+-----------------+--------+---------+-------------+---------+
| 0001      | Ivan Bayross    | Bombay | 400054  | Maharashtra | 15000   |
| 0002      | Vandana Saitwal | Madras | 780001  | Tamil Nadu  | 0       |
+-----------+-----------------+--------+---------+-------------+---------+
2 rows in set
```

### (e) Find the list of all clients who stay in city 'Bombay' or 'Delhi' or 'Madras'.

```sql
SELECT *
FROM client_master
WHERE city IN ('Bombay', 'Delhi', 'Madras');
```

Output:

```text
+-----------+-----------------+--------+---------+-------------+---------+
| client_no | name            | city   | pincode | state       | bal_due |
+-----------+-----------------+--------+---------+-------------+---------+
| 0001      | Ivan Bayross    | Bombay | 400054  | Maharashtra | 15000   |
| 0002      | Vandana Saitwal | Madras | 780001  | Tamil Nadu  | 0       |
| 0003      | Pramada Jaguste | Delhi  | 110001  | Delhi       | 5000    |
| 0004      | Basu Navindgi   | Bombay | 400057  | Maharashtra | 0       |
+-----------+-----------------+--------+---------+-------------+---------+
4 rows in set
```

### (f) Find the products whose selling price is greater than 2000 and less than or equal to 5000.

```sql
SELECT *
FROM product_master
WHERE selling_price > 2000
  AND selling_price <= 5000;
```

Output:

```text
+------------+---------------+----------------+--------------+-------------+------------+---------------+------------+
| product_no | description   | profit_percent | unit_measure | qty_on_hand | reoder_lvl | selling_price | cost_price |
+------------+---------------+----------------+--------------+-------------+------------+---------------+------------+
| P00003     | Monitor       | 10             | Piece        | 40          | 10         | 3200          | 2909       |
| P00004     | Hard Disk 1TB | 8              | Piece        | 60          | 15         | 5000          | 4630       |
+------------+---------------+----------------+--------------+-------------+------------+---------------+------------+
2 rows in set
```

**Question 2.** Draw the ER diagram for the Hospital Management System. See [Figure 2](#figure-2).

## Set 6

**Question 1.** client_master / product_master. Parts (a) and (b): see Schema C – client_master and product_master in Part A.

### (c) Retrieve the list of names and cities of all the clients.

```sql
SELECT name, city FROM client_master;
```

Output:

```text
+-----------------+-----------+
| name            | city      |
+-----------------+-----------+
| Ivan Bayross    | Bombay    |
| Vandana Saitwal | Madras    |
| Pramada Jaguste | Delhi     |
| Basu Navindgi   | Bombay    |
| Ravi Sreedharan | Bangalore |
+-----------------+-----------+
5 rows in set
```

### (d) Display the information for client no 0001 and 0002.

```sql
SELECT *
FROM client_master
WHERE client_no IN ('0001', '0002');
```

Output:

```text
+-----------+-----------------+--------+---------+-------------+---------+
| client_no | name            | city   | pincode | state       | bal_due |
+-----------+-----------------+--------+---------+-------------+---------+
| 0001      | Ivan Bayross    | Bombay | 400054  | Maharashtra | 15000   |
| 0002      | Vandana Saitwal | Madras | 780001  | Tamil Nadu  | 0       |
+-----------+-----------------+--------+---------+-------------+---------+
2 rows in set
```

### (e) Find all the products whose selling price is greater than 5000.

```sql
SELECT *
FROM product_master
WHERE selling_price > 5000;
```

Output:

```text
+------------+-------------+----------------+--------------+-------------+------------+---------------+------------+
| product_no | description | profit_percent | unit_measure | qty_on_hand | reoder_lvl | selling_price | cost_price |
+------------+-------------+----------------+--------------+-------------+------------+---------------+------------+
| P00005     | Printer     | 10             | Piece        | 25          | 5          | 8500          | 7727       |
+------------+-------------+----------------+--------------+-------------+------------+---------------+------------+
1 row in set
```

### (f) List the name, city and state of clients not in the state of 'Maharashtra'.

```sql
SELECT name, city, state
FROM client_master
WHERE state <> 'Maharashtra';
```

Output:

```text
+-----------------+-----------+------------+
| name            | city      | state      |
+-----------------+-----------+------------+
| Vandana Saitwal | Madras    | Tamil Nadu |
| Pramada Jaguste | Delhi     | Delhi      |
| Ravi Sreedharan | Bangalore | Karnataka  |
+-----------------+-----------+------------+
3 rows in set
```

**Question 2.** Draw the ER diagram for the University Management System. See [Figure 3](#figure-3).

## Set 7

**Question 1.** Road Way Travel System. Parts (a) and (b): see Schema D – Road Way Travel System in Part A.

### (c) Display all passengers.

```sql
SELECT * FROM Passenger;
```

Output:

```text
+--------------+------------------+-----+--------+------------+--------------------+
| Passenger_ID | Name             | Age | Gender | Phone      | Email              |
+--------------+------------------+-----+--------+------------+--------------------+
| 1            | Ravi Teja        | 28  | M      | 9876512340 | ravi.teja@mail.com |
| 2            | Anjali Sharma    | 34  | F      | 9876512341 | anjali.s@mail.com  |
| 3            | Mohammed Imran   | 45  | M      | 9876512342 | imran.m@mail.com   |
| 4            | Lakshmi Prasanna | 52  | F      | 9876512343 | lakshmi.p@mail.com |
| 5            | Karthik Naidu    | 23  | M      | 9876512344 | karthik.n@mail.com |
+--------------+------------------+-----+--------+------------+--------------------+
5 rows in set
```

### (d) Update a passenger phone number.

```sql
UPDATE Passenger
SET Phone = '9000011111'
WHERE Passenger_ID = 2;

SELECT Passenger_ID, Name, Phone
FROM Passenger
WHERE Passenger_ID = 2;
```

Output:

```text
+--------------+---------------+------------+
| Passenger_ID | Name          | Phone      |
+--------------+---------------+------------+
| 2            | Anjali Sharma | 9000011111 |
+--------------+---------------+------------+
1 row in set
```

### (e) Find the average ticket fare.

```sql
SELECT AVG(Total_Fare) AS Average_Fare
FROM Booking;
```

Output:

```text
+--------------+
| Average_Fare |
+--------------+
| 960.0        |
+--------------+
1 row in set
```

### (f) Display passengers who booked tickets.

```sql
SELECT DISTINCT p.Passenger_ID, p.Name, p.Phone
FROM Passenger p
JOIN Booking b ON b.Passenger_ID = p.Passenger_ID;
```

Output:

```text
+--------------+------------------+------------+
| Passenger_ID | Name             | Phone      |
+--------------+------------------+------------+
| 1            | Ravi Teja        | 9876512340 |
| 2            | Anjali Sharma    | 9000011111 |
| 3            | Mohammed Imran   | 9876512342 |
| 4            | Lakshmi Prasanna | 9876512343 |
+--------------+------------------+------------+
4 rows in set
```

**Question 2.** Draw the ER diagram for the University Management System. See [Figure 3](#figure-3).

## Set 8

**Question 1.** Road Way Travel System. Parts (a) and (b): see Schema D – Road Way Travel System in Part A.

### (c) Display buses having capacity greater than 40.

```sql
SELECT *
FROM Bus
WHERE Capacity > 40;
```

Output:

```text
+--------+------------+--------------+----------+-------------+
| Bus_ID | Bus_Number | Bus_Type     | Capacity | Status      |
+--------+------------+--------------+----------+-------------+
| 2      | TS08UB5678 | Express      | 52       | Active      |
| 3      | AP28TC9012 | Deluxe       | 45       | Active      |
| 4      | TS10UD3456 | Super Luxury | 50       | Maintenance |
+--------+------------+--------------+----------+-------------+
3 rows in set
```

### (d) Display passenger booking details.

```sql
SELECT b.Booking_ID, p.Name AS Passenger, r.Source, r.Destination,
       s.Travel_Date, b.Seat_Number AS Seat, b.Total_Fare AS Fare
FROM Booking b
JOIN Passenger p ON p.Passenger_ID = b.Passenger_ID
JOIN Schedule  s ON s.Schedule_ID  = b.Schedule_ID
JOIN Route     r ON r.Route_ID     = s.Route_ID;
```

Output:

```text
+------------+------------------+-----------+-------------+-------------+------+------+
| Booking_ID | Passenger        | Source    | Destination | Travel_Date | Seat | Fare |
+------------+------------------+-----------+-------------+-------------+------+------+
| 1          | Ravi Teja        | Hyderabad | Bengaluru   | 2026-12-05  | 12   | 850  |
| 2          | Anjali Sharma    | Hyderabad | Chennai     | 2026-12-06  | 5    | 1200 |
| 3          | Mohammed Imran   | Hyderabad | Vijayawada  | 2026-12-07  | 18   | 950  |
| 4          | Lakshmi Prasanna | Hyderabad | Mumbai      | 2026-12-08  | 22   | 700  |
| 5          | Ravi Teja        | Bengaluru | Chennai     | 2026-12-09  | 9    | 1100 |
+------------+------------------+-----------+-------------+-------------+------+------+
5 rows in set
```

### (e) Find the average ticket fare.

```sql
SELECT AVG(Total_Fare) AS Average_Fare
FROM Booking;
```

Output:

```text
+--------------+
| Average_Fare |
+--------------+
| 960.0        |
+--------------+
1 row in set
```

### (f) Display passengers who booked tickets.

```sql
SELECT DISTINCT p.Passenger_ID, p.Name, p.Phone
FROM Passenger p
JOIN Booking b ON b.Passenger_ID = p.Passenger_ID;
```

Output:

```text
+--------------+------------------+------------+
| Passenger_ID | Name             | Phone      |
+--------------+------------------+------------+
| 1            | Ravi Teja        | 9876512340 |
| 2            | Anjali Sharma    | 9000011111 |
| 3            | Mohammed Imran   | 9876512342 |
| 4            | Lakshmi Prasanna | 9876512343 |
+--------------+------------------+------------+
4 rows in set
```

**Question 2.** Draw the ER diagram for the Hospital Management System. See [Figure 2](#figure-2).

---

# Part C – ER Diagrams

## Figure 1
### ER Diagram – Library Management System

![ER diagram – Library Management System](er_library.png)

*Asked in Set 1.*

## Figure 2
### ER Diagram – Hospital Management System

![ER diagram – Hospital Management System](er_hospital.png)

*Asked in Sets 2, 5, 8.*

## Figure 3
### ER Diagram – University Management System

![ER diagram – University Management System](er_university.png)

*Asked in Sets 3, 6, 7.*

## Figure 4
### ER Diagram – Roadway Travel System

![ER diagram – Roadway Travel System](er_roadway.png)

*Asked in Set 4.*
