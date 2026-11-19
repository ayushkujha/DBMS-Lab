/**
 * Examination content for all 8 sets.
 *
 * Question wording and set organisation: DBMS_Queries.md
 * CREATE TABLE / INSERT statements and solutions (c)-(f): DBMS_Lab_Solutions.md
 *
 * ER-diagram questions (Question 2 of every set) are intentionally excluded.
 * SQL below is copied verbatim from DBMS_Lab_Solutions.md.
 */
import type { SetId, TaskId } from './types';

/* ------------------------------------------------------------------------ */
/* Completion checks — evaluated by the backend against the real database.  */
/* ------------------------------------------------------------------------ */

export type TaskCheck =
  /** Every listed table exists (as a base table) with every listed column. */
  | { kind: 'tables'; tables: { name: string; columns: string[] }[] }
  /** Every listed table holds at least `min` rows. */
  | { kind: 'rows'; tables: string[]; min: number }
  /**
   * A successful SELECT typed by the student returns exactly the same rows
   * (order-insensitive) as `reference` run against the same database.
   * `mustUse` lists regexes the statement must contain (e.g. EXISTS / ANY),
   * `tables` lists table names, at least one of which must be referenced.
   */
  | { kind: 'result'; reference: string; tables: string[]; mustUse?: { pattern: string; label: string }[] }
  /** Some view in the database returns exactly the rows of `reference`. */
  | { kind: 'view'; reference: string }
  /** `table` has column `column` of MySQL DATA_TYPE `dataType`. */
  | { kind: 'column'; table: string; column: string; dataType: string }
  /** A successful UPDATE on `table` that assigns `column` changed at least one row. */
  | { kind: 'update'; table: string; column: string };

export interface ExamTask {
  id: TaskId;
  /** Short label used in the question reference panel. */
  label: string;
  /** Exact wording from DBMS_Queries.md. */
  question: string;
  /** Reference SQL from DBMS_Lab_Solutions.md (may contain several statements). */
  solution: string;
  hint: string;
  check: TaskCheck;
}

export interface SchemaRelation {
  name: string;
  /** Attribute list exactly as written in DBMS_Queries.md. */
  attributes: string;
}

export interface ExamSet {
  id: SetId;
  title: string;
  schemaKey: 'college' | 'sailors' | 'client' | 'roadway';
  heading: string;
  relations: SchemaRelation[];
  /** Notes from the solution file about assumptions / source fixes. */
  notes: string[];
  tasks: ExamTask[];
}

/* ------------------------------------------------------------------------ */
/* Schema A – College Database (Sets 1 and 2)                               */
/* ------------------------------------------------------------------------ */

const COLLEGE_CREATE = `CREATE TABLE Students (
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
);`;

const COLLEGE_INSERT = `INSERT INTO Students VALUES (101, 'Arjun Reddy',  'CSE', 3, 'arjun@vjit.ac.in',  '9876500001');
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
INSERT INTO Course_Faculty VALUES (205, 304);`;

const COLLEGE_TABLES = [
  { name: 'Students', columns: ['Student_ID', 'Student_name', 'Branch', 'Year', 'Email', 'Phone'] },
  { name: 'Courses', columns: ['Course_id', 'Course_name', 'Credits'] },
  { name: 'Faculty', columns: ['Faculty_id', 'Faculty_Name', 'Department'] },
  { name: 'Enrollment', columns: ['Enrollment_ID', 'Student_ID', 'Course_id', 'Enrollment_Date', 'Grade'] },
  { name: 'Course_Faculty', columns: ['Course_id', 'Faculty_id'] },
];

const COLLEGE_RELATIONS: SchemaRelation[] = [
  { name: 'Students', attributes: 'Student_ID: integer, Student_name: varchar, Branch: varchar, Year: integer, Email: varchar, Phone: varchar' },
  { name: 'Courses', attributes: 'Course_id: integer, Course_name: varchar, Credits: integer' },
  { name: 'Faculty', attributes: 'Faculty_id: integer, Faculty_Name: varchar, Department: varchar' },
  { name: 'Enrollment', attributes: 'Enrollment_ID: integer, Student_ID: integer, Course_id: integer, Enrollment_Date: date, Grade: varchar' },
  { name: 'Course_Faculty', attributes: 'Course_id: integer, Faculty_id: integer' },
];

const COLLEGE_NOTES = [
  "Source schema has the typo 'Coutrse_id' in Course_Faculty; it is written as Course_id so the foreign key to Courses works.",
];

function collegeAB(): ExamTask[] {
  return [
    {
      id: 'a',
      label: 'Create tables',
      question: 'Create the tables with the appropriate integrity constraints.',
      solution: COLLEGE_CREATE,
      hint: 'Create the parent tables (Students, Courses, Faculty) first. Enrollment and Course_Faculty hold FOREIGN KEYs to them, so they must be created last.',
      check: { kind: 'tables', tables: COLLEGE_TABLES },
    },
    {
      id: 'b',
      label: 'Insert records',
      question: 'Insert around 5 records in each of the tables.',
      solution: COLLEGE_INSERT,
      hint: 'Insert parent rows (Students, Courses, Faculty) before child rows (Enrollment, Course_Faculty), otherwise the FOREIGN KEY checks fail with ERROR 1452. Each table needs at least 5 rows.',
      check: { kind: 'rows', tables: COLLEGE_TABLES.map((t) => t.name), min: 5 },
    },
  ];
}

const CSE_STUDENTS = `SELECT * FROM Students
WHERE Branch = 'CSE';`;

/* ------------------------------------------------------------------------ */
/* Schema B – Sailors Database (Sets 3 and 4)                               */
/* ------------------------------------------------------------------------ */

const SAILORS_CREATE = `CREATE TABLE Sailors (
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
);`;

const SAILORS_INSERT = `INSERT INTO Sailors VALUES (22, 'Dustin',  7, 45.0);
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
INSERT INTO Reserves VALUES (64, 104, DATE '2026-09-05');`;

const SAILORS_TABLES = [
  { name: 'Sailors', columns: ['sid', 'sname', 'rating', 'age'] },
  { name: 'Boats', columns: ['bid', 'bname', 'color'] },
  { name: 'Reserves', columns: ['sid', 'bid', 'day'] },
];

const SAILORS_RELATIONS: SchemaRelation[] = [
  { name: 'Sailors', attributes: 'sid: integer, sname: string, rating: integer, age: real' },
  { name: 'Boats', attributes: 'bid: integer, bname: string, color: string' },
  { name: 'Reserves', attributes: 'sid: integer, bid: integer, day: date' },
];

function sailorsAB(): ExamTask[] {
  return [
    {
      id: 'a',
      label: 'Create tables',
      question: 'Create the tables with the appropriate integrity constraints.',
      solution: SAILORS_CREATE,
      hint: 'Reserves references both Sailors and Boats, so create it last. Its primary key is the composite (sid, bid, day).',
      check: { kind: 'tables', tables: SAILORS_TABLES },
    },
    {
      id: 'b',
      label: 'Insert records',
      question: 'Insert around 5 records in each of the tables.',
      solution: SAILORS_INSERT,
      hint: 'Insert Sailors and Boats before Reserves. Each table needs at least 5 rows.',
      check: { kind: 'rows', tables: SAILORS_TABLES.map((t) => t.name), min: 5 },
    },
  ];
}

/* ------------------------------------------------------------------------ */
/* Schema C – client_master and product_master (Sets 5 and 6)               */
/* ------------------------------------------------------------------------ */

const CLIENT_CREATE = `CREATE TABLE client_master (
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
);`;

const CLIENT_INSERT = `INSERT INTO client_master VALUES ('0001', 'Ivan Bayross',     'Bombay',    400054, 'Maharashtra', 15000);
INSERT INTO client_master VALUES ('0002', 'Vandana Saitwal',  'Madras',    780001, 'Tamil Nadu',  0);
INSERT INTO client_master VALUES ('0003', 'Pramada Jaguste',  'Delhi',     110001, 'Delhi',       5000);
INSERT INTO client_master VALUES ('0004', 'Basu Navindgi',    'Bombay',    400057, 'Maharashtra', 0);
INSERT INTO client_master VALUES ('0005', 'Ravi Sreedharan',  'Bangalore', 560001, 'Karnataka',   2000);

INSERT INTO product_master VALUES ('P00001', 'Keyboard',     12.50, 'Piece', 100, 20,  500,  444);
INSERT INTO product_master VALUES ('P00002', 'Mouse',        15.00, 'Piece', 150, 30,  350,  304);
INSERT INTO product_master VALUES ('P00003', 'Monitor',      10.00, 'Piece',  40, 10, 3200, 2909);
INSERT INTO product_master VALUES ('P00004', 'Hard Disk 1TB', 8.00, 'Piece',  60, 15, 5000, 4630);
INSERT INTO product_master VALUES ('P00005', 'Printer',      10.00, 'Piece',  25,  5, 8500, 7727);`;

const CLIENT_TABLES = [
  { name: 'client_master', columns: ['client_no', 'name', 'city', 'pincode', 'state', 'bal_due'] },
  {
    name: 'product_master',
    columns: ['product_no', 'description', 'profit_percent', 'unit_measure', 'qty_on_hand', 'reoder_lvl', 'selling_price', 'cost_price'],
  },
];

const CLIENT_RELATIONS: SchemaRelation[] = [
  {
    name: 'client_master',
    attributes: 'client_no: varchar, primary key; name: varchar(20); city: varchar(15); pin_code: integer; state: varchar(20); bal_due: integer',
  },
  {
    name: 'product_master',
    attributes:
      'product_no: varchar(10), primary key; description: varchar(20); profit_percent: decimal(5,2); unit_measure: varchar(8); qty_on_hand: number(6); reorder_lvl: number(6); selling_price: number(10); cost_price: number(10)',
  },
];

const CLIENT_NOTES = [
  "client_no varchar() has no length, so VARCHAR(10) is used; 'pin code' contains a space, so the column is pincode; NUMBER(n) is Oracle syntax, so INT is used. The column name reoder_lvl is kept exactly as in the source.",
];

function clientAB(): ExamTask[] {
  return [
    {
      id: 'a',
      label: 'Create tables',
      question: 'Create the tables with the appropriate integrity constraints.',
      solution: CLIENT_CREATE,
      hint: 'client_no and product_no are VARCHAR primary keys. Use INT in place of Oracle NUMBER(n) and add CHECK constraints for non-negative quantities and prices.',
      check: { kind: 'tables', tables: CLIENT_TABLES },
    },
    {
      id: 'b',
      label: 'Insert records',
      question: 'Insert around 5 records in each of the tables.',
      solution: CLIENT_INSERT,
      hint: "client_no is a string, so quote it: '0001'. Each table needs at least 5 rows.",
      check: { kind: 'rows', tables: CLIENT_TABLES.map((t) => t.name), min: 5 },
    },
  ];
}

const CLIENT_0001_0002 = `SELECT *
FROM client_master
WHERE client_no IN ('0001', '0002');`;

/* ------------------------------------------------------------------------ */
/* Schema D – Road Way Travel System (Sets 7 and 8)                         */
/* ------------------------------------------------------------------------ */

const ROADWAY_CREATE = `CREATE TABLE Passenger (
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
);`;

const ROADWAY_INSERT = `INSERT INTO Passenger VALUES (1, 'Ravi Teja',        28, 'M', '9876512340', 'ravi.teja@mail.com');
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
INSERT INTO Payment VALUES (5, 5, DATE '2026-11-24', 1100.00, 'Card', 'Paid');`;

const ROADWAY_TABLES = [
  { name: 'Passenger', columns: ['Passenger_ID', 'Name', 'Age', 'Gender', 'Phone', 'Email'] },
  { name: 'Bus', columns: ['Bus_ID', 'Bus_Number', 'Bus_Type', 'Capacity', 'Status'] },
  { name: 'Driver', columns: ['Driver_ID', 'Driver_Name', 'License_Number', 'Phone', 'Experience'] },
  { name: 'Route', columns: ['Route_ID', 'Source', 'Destination', 'Distance', 'Duration'] },
  { name: 'Schedule', columns: ['Schedule_ID', 'Bus_ID', 'Route_ID', 'Driver_ID', 'Departure_Time', 'Arrival_Time', 'Travel_Date'] },
  { name: 'Booking', columns: ['Booking_ID', 'Passenger_ID', 'Schedule_ID', 'Booking_Date', 'Seat_Number', 'Total_Fare', 'Booking_Status'] },
  { name: 'Payment', columns: ['Payment_ID', 'Booking_ID', 'Payment_Date', 'Amount', 'Payment_Mode', 'Payment_Status'] },
];

const ROADWAY_RELATIONS: SchemaRelation[] = [
  { name: 'Passenger', attributes: 'Passenger_ID, Name, Age, Gender, Phone, Email' },
  { name: 'Bus', attributes: 'Bus_ID, Bus_Number, Bus_Type, Capacity, Status' },
  { name: 'Driver', attributes: 'Driver_ID, Driver_Name, License_Number, Phone, Experience' },
  { name: 'Route', attributes: 'Route_ID, Source, Destination, Distance, Duration' },
  { name: 'Schedule', attributes: 'Schedule_ID, Bus_ID, Route_ID, Driver_ID, Departure_Time, Arrival_Time, Travel_Date' },
  { name: 'Booking', attributes: 'Booking_ID, Passenger_ID, Schedule_ID, Booking_Date, Seat_Number, Total_Fare, Booking_Status' },
  { name: 'Payment', attributes: 'Payment_ID, Booking_ID, Payment_Date, Amount, Payment_Mode, Payment_Status' },
];

const ROADWAY_NOTES = [
  'The source gives column names only, so data types and constraints are assumed (as documented in the solution file). TIME columns suit MySQL.',
];

function roadwayAB(): ExamTask[] {
  return [
    {
      id: 'a',
      label: 'Create tables',
      question: 'Create the tables with the appropriate integrity constraints.',
      solution: ROADWAY_CREATE,
      hint: 'Order matters: Passenger, Bus, Driver, Route first; then Schedule (references Bus, Route, Driver); then Booking (references Passenger, Schedule); Payment last (references Booking).',
      check: { kind: 'tables', tables: ROADWAY_TABLES },
    },
    {
      id: 'b',
      label: 'Insert records',
      question: 'Insert around 5 records in each of the tables.',
      solution: ROADWAY_INSERT,
      hint: 'Insert in the same order the tables were created so every FOREIGN KEY finds its parent row. Each table needs at least 5 rows.',
      check: { kind: 'rows', tables: ROADWAY_TABLES.map((t) => t.name), min: 5 },
    },
  ];
}

const AVERAGE_FARE = `SELECT AVG(Total_Fare) AS Average_Fare
FROM Booking;`;

const PASSENGERS_WHO_BOOKED = `SELECT DISTINCT p.Passenger_ID, p.Name, p.Phone
FROM Passenger p
JOIN Booking b ON b.Passenger_ID = p.Passenger_ID;`;

/* ------------------------------------------------------------------------ */
/* The eight sets                                                           */
/* ------------------------------------------------------------------------ */

export const EXAM_SETS: ExamSet[] = [
  {
    id: 1,
    title: 'College Database',
    schemaKey: 'college',
    heading: 'Database Schema for a College DB',
    relations: COLLEGE_RELATIONS,
    notes: COLLEGE_NOTES,
    tasks: [
      ...collegeAB(),
      {
        id: 'c',
        label: 'Display CSE students',
        question: 'Display all CSE students.',
        solution: CSE_STUDENTS,
        hint: "Filter Students with WHERE Branch = 'CSE'.",
        check: { kind: 'result', reference: CSE_STUDENTS, tables: ['Students'] },
      },
      {
        id: 'd',
        label: 'Create third-year view',
        question: 'Create a view containing only 3rd-year students.',
        solution: `CREATE VIEW Third_Year_Students AS
SELECT * FROM Students
WHERE Year = 3;

SELECT * FROM Third_Year_Students;`,
        hint: 'CREATE VIEW <name> AS SELECT ... WHERE Year = 3; then query the view like a table.',
        check: { kind: 'view', reference: 'SELECT * FROM Students WHERE Year = 3' },
      },
      {
        id: 'e',
        label: 'Grade-A count per course',
        question: 'Find Grade-A count per course.',
        solution: `SELECT c.Course_id, c.Course_name, COUNT(*) AS Grade_A_Count
FROM Enrollment e
JOIN Courses c ON c.Course_id = e.Course_id
WHERE e.Grade = 'A'
GROUP BY c.Course_id, c.Course_name;`,
        hint: "Join Enrollment with Courses, keep only Grade = 'A', then GROUP BY the course and COUNT(*).",
        check: {
          kind: 'result',
          reference: `SELECT c.Course_id, c.Course_name, COUNT(*) AS Grade_A_Count
FROM Enrollment e
JOIN Courses c ON c.Course_id = e.Course_id
WHERE e.Grade = 'A'
GROUP BY c.Course_id, c.Course_name`,
          tables: ['Enrollment'],
        },
      },
      {
        id: 'f',
        label: 'EXISTS query',
        question: 'Find courses having at least one enrollment using EXISTS.',
        solution: `SELECT *
FROM Courses c
WHERE EXISTS (SELECT 1
              FROM Enrollment e
              WHERE e.Course_id = c.Course_id);`,
        hint: 'Use a correlated subquery: WHERE EXISTS (SELECT 1 FROM Enrollment e WHERE e.Course_id = c.Course_id).',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM Courses c
WHERE EXISTS (SELECT 1
              FROM Enrollment e
              WHERE e.Course_id = c.Course_id)`,
          tables: ['Courses'],
          mustUse: [{ pattern: '\\bEXISTS\\b', label: 'EXISTS' }],
        },
      },
    ],
  },
  {
    id: 2,
    title: 'College Database',
    schemaKey: 'college',
    heading: 'Database Schema for a College DB',
    relations: COLLEGE_RELATIONS,
    notes: COLLEGE_NOTES,
    tasks: [
      ...collegeAB(),
      {
        id: 'c',
        label: 'Display CSE students',
        question: 'Display all CSE students.',
        solution: CSE_STUDENTS,
        hint: "Filter Students with WHERE Branch = 'CSE'.",
        check: { kind: 'result', reference: CSE_STUDENTS, tables: ['Students'] },
      },
      {
        id: 'd',
        label: 'Credits > ANY 3-credit course',
        question: 'Find courses with credits greater than ANY 3-credit course.',
        solution: `SELECT *
FROM Courses
WHERE Credits > ANY (SELECT Credits
                     FROM Courses
                     WHERE Credits = 3);`,
        hint: 'Compare Credits with > ANY (subquery returning the credits of 3-credit courses).',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM Courses
WHERE Credits > ANY (SELECT Credits
                     FROM Courses
                     WHERE Credits = 3)`,
          tables: ['Courses'],
          mustUse: [{ pattern: '\\b(ANY|SOME)\\s*\\(', label: 'ANY' }],
        },
      },
      {
        id: 'e',
        label: 'Add Date_of_Birth',
        question: 'Add Date_of_Birth to Students.',
        solution: `ALTER TABLE Students ADD COLUMN Date_of_Birth DATE;

SELECT Student_ID, Student_name, Date_of_Birth FROM Students;`,
        hint: 'ALTER TABLE Students ADD COLUMN Date_of_Birth DATE; — existing rows get NULL.',
        check: { kind: 'column', table: 'Students', column: 'Date_of_Birth', dataType: 'date' },
      },
      {
        id: 'f',
        label: 'Update enrollment grade',
        question: 'Update an enrollment grade.',
        solution: `UPDATE Enrollment
SET Grade = 'A'
WHERE Enrollment_ID = 2;

SELECT * FROM Enrollment WHERE Enrollment_ID = 2;`,
        hint: 'UPDATE Enrollment SET Grade = ... WHERE Enrollment_ID = ...; — the change must actually modify a row.',
        check: { kind: 'update', table: 'Enrollment', column: 'Grade' },
      },
    ],
  },
  {
    id: 3,
    title: 'Sailors Database',
    schemaKey: 'sailors',
    heading: 'Database Schema for a Sailors Database',
    relations: SAILORS_RELATIONS,
    notes: [],
    tasks: [
      ...sailorsAB(),
      {
        id: 'c',
        label: 'Sailors who reserved boat 103',
        question: 'Find the names of sailors who have reserved boat number 103.',
        solution: `SELECT DISTINCT s.sname
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
WHERE r.bid = 103;`,
        hint: 'Join Sailors with Reserves on sid and filter r.bid = 103. DISTINCT removes repeated names.',
        check: {
          kind: 'result',
          reference: `SELECT DISTINCT s.sname
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
WHERE r.bid = 103`,
          tables: ['Sailors'],
        },
      },
      {
        id: 'd',
        label: 'Highest-rated sailors',
        question: 'Find the sailors with the highest rating.',
        solution: `SELECT *
FROM Sailors
WHERE rating = (SELECT MAX(rating) FROM Sailors);`,
        hint: 'Compare rating with a scalar subquery: (SELECT MAX(rating) FROM Sailors).',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM Sailors
WHERE rating = (SELECT MAX(rating) FROM Sailors)`,
          tables: ['Sailors'],
        },
      },
      {
        id: 'e',
        label: 'Sailors and reserved boats',
        question: 'List all the sailors and boats who have reserved.',
        solution: `SELECT s.sid, s.sname, b.bid, b.bname, r.day
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
JOIN Boats b    ON b.bid = r.bid;`,
        hint: 'Join all three tables: Sailors -> Reserves (sid) -> Boats (bid).',
        check: {
          kind: 'result',
          reference: `SELECT s.sid, s.sname, b.bid, b.bname, r.day
FROM Sailors s
JOIN Reserves r ON r.sid = s.sid
JOIN Boats b    ON b.bid = r.bid`,
          tables: ['Reserves'],
        },
      },
      {
        id: 'f',
        label: 'Sailors eligible to vote',
        question: 'Find the sailors who are eligible to vote.',
        solution: `SELECT *
FROM Sailors
WHERE age >= 18;`,
        hint: 'Eligible to vote means age 18 or above: WHERE age >= 18.',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM Sailors
WHERE age >= 18`,
          tables: ['Sailors'],
        },
      },
    ],
  },
  {
    id: 4,
    title: 'Sailors Database',
    schemaKey: 'sailors',
    heading: 'Database Schema for a Sailors Database',
    relations: SAILORS_RELATIONS,
    notes: [],
    tasks: [
      ...sailorsAB(),
      {
        id: 'c',
        label: 'Reserved red and green boat',
        question: 'Find the names of sailors who have reserved a red and green boat.',
        solution: `SELECT s.sname
FROM Sailors s
WHERE s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'red')
  AND s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'green');`,
        hint: "A sailor qualifies only if their sid is IN the set of red-boat reservers AND IN the set of green-boat reservers.",
        check: {
          kind: 'result',
          reference: `SELECT s.sname
FROM Sailors s
WHERE s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'red')
  AND s.sid IN (SELECT r.sid FROM Reserves r
                JOIN Boats b ON b.bid = r.bid
                WHERE b.color = 'green')`,
          tables: ['Sailors'],
        },
      },
      {
        id: 'd',
        label: 'Avg age per rating (>= 2)',
        question: 'Find the average age of sailors for each rating level that has at least two sailors.',
        solution: `SELECT rating, AVG(age) AS avg_age
FROM Sailors
GROUP BY rating
HAVING COUNT(*) >= 2;`,
        hint: 'GROUP BY rating, then filter groups with HAVING COUNT(*) >= 2.',
        check: {
          kind: 'result',
          reference: `SELECT rating, AVG(age) AS avg_age
FROM Sailors
GROUP BY rating
HAVING COUNT(*) >= 2`,
          tables: ['Sailors'],
        },
      },
      {
        id: 'e',
        label: 'Count reservations',
        question: 'Count the number of reservations.',
        solution: `SELECT COUNT(*) AS Total_Reservations
FROM Reserves;`,
        hint: 'COUNT(*) over the Reserves table.',
        check: {
          kind: 'result',
          reference: `SELECT COUNT(*) AS Total_Reservations
FROM Reserves`,
          tables: ['Reserves'],
        },
      },
      {
        id: 'f',
        label: 'sid with >= 1 reservation',
        question: 'Find the sid of sailors who have reserved at least one boat.',
        solution: `SELECT DISTINCT sid
FROM Reserves;`,
        hint: 'Every sid in Reserves has reserved a boat; use DISTINCT to list each once.',
        check: {
          kind: 'result',
          reference: `SELECT DISTINCT sid
FROM Reserves`,
          tables: ['Reserves', 'Sailors'],
        },
      },
    ],
  },
  {
    id: 5,
    title: 'Client and Product Database',
    schemaKey: 'client',
    heading: 'Database Schema for client_master and product_master',
    relations: CLIENT_RELATIONS,
    notes: CLIENT_NOTES,
    tasks: [
      ...clientAB(),
      {
        id: 'c',
        label: 'Names of all clients',
        question: 'Find out the names of all the clients.',
        solution: `SELECT name FROM client_master;`,
        hint: 'Project only the name column from client_master.',
        check: { kind: 'result', reference: 'SELECT name FROM client_master', tables: ['client_master'] },
      },
      {
        id: 'd',
        label: 'Clients 0001 and 0002',
        question: 'Display the information for client numbers 0001 and 0002.',
        solution: CLIENT_0001_0002,
        hint: "client_no is VARCHAR, so compare with strings: WHERE client_no IN ('0001', '0002').",
        check: { kind: 'result', reference: CLIENT_0001_0002, tables: ['client_master'] },
      },
      {
        id: 'e',
        label: 'Clients in Bombay/Delhi/Madras',
        question: "Find the list of all clients who stay in the city 'Bombay', 'Delhi', or 'Madras'.",
        solution: `SELECT *
FROM client_master
WHERE city IN ('Bombay', 'Delhi', 'Madras');`,
        hint: "Use IN with a list of cities instead of chaining OR conditions.",
        check: {
          kind: 'result',
          reference: `SELECT *
FROM client_master
WHERE city IN ('Bombay', 'Delhi', 'Madras')`,
          tables: ['client_master'],
        },
      },
      {
        id: 'f',
        label: 'Price > 2000 and <= 5000',
        question: 'Find the product whose selling price is greater than 2000 and less than or equal to 5000.',
        solution: `SELECT *
FROM product_master
WHERE selling_price > 2000
  AND selling_price <= 5000;`,
        hint: 'Combine two comparisons with AND: > 2000 AND <= 5000 (BETWEEN would wrongly include 2000).',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM product_master
WHERE selling_price > 2000
  AND selling_price <= 5000`,
          tables: ['product_master'],
        },
      },
    ],
  },
  {
    id: 6,
    title: 'Client and Product Database',
    schemaKey: 'client',
    heading: 'Database Schema for client_master and product_master',
    relations: CLIENT_RELATIONS,
    notes: CLIENT_NOTES,
    tasks: [
      ...clientAB(),
      {
        id: 'c',
        label: 'Names and cities of clients',
        question: 'Retrieve the list of names and cities of all the clients.',
        solution: `SELECT name, city FROM client_master;`,
        hint: 'Select just the name and city columns.',
        check: { kind: 'result', reference: 'SELECT name, city FROM client_master', tables: ['client_master'] },
      },
      {
        id: 'd',
        label: 'Clients 0001 and 0002',
        question: 'Display the information for client numbers 0001 and 0002.',
        solution: CLIENT_0001_0002,
        hint: "client_no is VARCHAR, so compare with strings: WHERE client_no IN ('0001', '0002').",
        check: { kind: 'result', reference: CLIENT_0001_0002, tables: ['client_master'] },
      },
      {
        id: 'e',
        label: 'Products priced > 5000',
        question: 'Find all the products whose selling price is greater than 5000.',
        solution: `SELECT *
FROM product_master
WHERE selling_price > 5000;`,
        hint: 'WHERE selling_price > 5000 on product_master.',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM product_master
WHERE selling_price > 5000`,
          tables: ['product_master'],
        },
      },
      {
        id: 'f',
        label: 'Clients outside Maharashtra',
        question: "List the name, city, and state of clients not in the state of 'Maharashtra'.",
        solution: `SELECT name, city, state
FROM client_master
WHERE state <> 'Maharashtra';`,
        hint: "Use the not-equal operator: WHERE state <> 'Maharashtra'.",
        check: {
          kind: 'result',
          reference: `SELECT name, city, state
FROM client_master
WHERE state <> 'Maharashtra'`,
          tables: ['client_master'],
        },
      },
    ],
  },
  {
    id: 7,
    title: 'Roadway Travel System',
    schemaKey: 'roadway',
    heading: 'Database Schema for a Roadway Travel System',
    relations: ROADWAY_RELATIONS,
    notes: ROADWAY_NOTES,
    tasks: [
      ...roadwayAB(),
      {
        id: 'c',
        label: 'Display all passengers',
        question: 'Display all passengers.',
        solution: `SELECT * FROM Passenger;`,
        hint: 'SELECT * from the Passenger table.',
        check: { kind: 'result', reference: 'SELECT * FROM Passenger', tables: ['Passenger'] },
      },
      {
        id: 'd',
        label: "Update passenger's phone",
        question: "Update a passenger's phone number.",
        solution: `UPDATE Passenger
SET Phone = '9000011111'
WHERE Passenger_ID = 2;

SELECT Passenger_ID, Name, Phone
FROM Passenger
WHERE Passenger_ID = 2;`,
        hint: "UPDATE Passenger SET Phone = '...' WHERE Passenger_ID = ...; — always include a WHERE clause.",
        check: { kind: 'update', table: 'Passenger', column: 'Phone' },
      },
      {
        id: 'e',
        label: 'Average ticket fare',
        question: 'Find the average ticket fare.',
        solution: AVERAGE_FARE,
        hint: 'AVG(Total_Fare) over the Booking table.',
        check: { kind: 'result', reference: 'SELECT AVG(Total_Fare) AS Average_Fare FROM Booking', tables: ['Booking'] },
      },
      {
        id: 'f',
        label: 'Passengers who booked',
        question: 'Display passengers who booked tickets.',
        solution: PASSENGERS_WHO_BOOKED,
        hint: 'Join Passenger with Booking on Passenger_ID; DISTINCT lists a passenger with several bookings once.',
        check: {
          kind: 'result',
          reference: PASSENGERS_WHO_BOOKED,
          tables: ['Passenger'],
        },
      },
    ],
  },
  {
    id: 8,
    title: 'Roadway Travel System',
    schemaKey: 'roadway',
    heading: 'Database Schema for a Roadway Travel System',
    relations: ROADWAY_RELATIONS,
    notes: ROADWAY_NOTES,
    tasks: [
      ...roadwayAB(),
      {
        id: 'c',
        label: 'Buses with capacity > 40',
        question: 'Display buses having capacity greater than 40.',
        solution: `SELECT *
FROM Bus
WHERE Capacity > 40;`,
        hint: 'WHERE Capacity > 40 (a bus with exactly 40 seats is excluded).',
        check: {
          kind: 'result',
          reference: `SELECT *
FROM Bus
WHERE Capacity > 40`,
          tables: ['Bus'],
        },
      },
      {
        id: 'd',
        label: 'Passenger booking details',
        question: 'Display passenger booking details.',
        solution: `SELECT b.Booking_ID, p.Name AS Passenger, r.Source, r.Destination,
       s.Travel_Date, b.Seat_Number AS Seat, b.Total_Fare AS Fare
FROM Booking b
JOIN Passenger p ON p.Passenger_ID = b.Passenger_ID
JOIN Schedule  s ON s.Schedule_ID  = b.Schedule_ID
JOIN Route     r ON r.Route_ID     = s.Route_ID;`,
        hint: 'Join Booking -> Passenger (Passenger_ID), Booking -> Schedule (Schedule_ID), Schedule -> Route (Route_ID).',
        check: {
          kind: 'result',
          reference: `SELECT b.Booking_ID, p.Name AS Passenger, r.Source, r.Destination,
       s.Travel_Date, b.Seat_Number AS Seat, b.Total_Fare AS Fare
FROM Booking b
JOIN Passenger p ON p.Passenger_ID = b.Passenger_ID
JOIN Schedule  s ON s.Schedule_ID  = b.Schedule_ID
JOIN Route     r ON r.Route_ID     = s.Route_ID`,
          tables: ['Booking'],
        },
      },
      {
        id: 'e',
        label: 'Average ticket fare',
        question: 'Find the average ticket fare.',
        solution: AVERAGE_FARE,
        hint: 'AVG(Total_Fare) over the Booking table.',
        check: { kind: 'result', reference: 'SELECT AVG(Total_Fare) AS Average_Fare FROM Booking', tables: ['Booking'] },
      },
      {
        id: 'f',
        label: 'Passengers who booked',
        question: 'Display passengers who booked tickets.',
        solution: PASSENGERS_WHO_BOOKED,
        hint: 'Join Passenger with Booking on Passenger_ID; DISTINCT lists a passenger with several bookings once.',
        check: {
          kind: 'result',
          reference: PASSENGERS_WHO_BOOKED,
          tables: ['Passenger'],
        },
      },
    ],
  },
];

export function getExamSet(id: SetId): ExamSet {
  const set = EXAM_SETS.find((s) => s.id === id);
  if (!set) throw new Error(`Unknown set ${id}`);
  return set;
}
