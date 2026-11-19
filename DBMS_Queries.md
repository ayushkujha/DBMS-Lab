# DBMS Queries

## SET-1

### 1. Database Schema for a College DB

**Students** (`Student_ID`: integer, `Student_name`: varchar, `Branch`: varchar, `Year`: integer, `Email`: varchar, `Phone`: varchar)

**Courses** (`Course_id`: integer, `Course_name`: varchar, `Credits`: integer)

**Faculty** (`Faculty_id`: integer, `Faculty_Name`: varchar, `Department`: varchar)

**Enrollment** (`Enrollment_ID`: integer, `Student_ID`: integer, `Course_id`: integer, `Enrollment_Date`: date, `Grade`: varchar)

**Course_Faculty** (`Course_id`: integer, `Faculty_id`: integer)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Display all CSE students.  
d. Create a view containing only 3rd-year students.  
e. Find Grade-A count per course.  
f. Find courses having at least one enrollment using `EXISTS`.

### 2. ER Diagram

Draw an ER diagram for a **Library Management System**.

---

## SET-2

### 1. Database Schema for a College DB

**Students** (`Student_ID`: integer, `Student_name`: varchar, `Branch`: varchar, `Year`: integer, `Email`: varchar, `Phone`: varchar)

**Courses** (`Course_id`: integer, `Course_name`: varchar, `Credits`: integer)

**Faculty** (`Faculty_id`: integer, `Faculty_Name`: varchar, `Department`: varchar)

**Enrollment** (`Enrollment_ID`: integer, `Student_ID`: integer, `Course_id`: integer, `Enrollment_Date`: date, `Grade`: varchar)

**Course_Faculty** (`Course_id`: integer, `Faculty_id`: integer)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Display all CSE students.  
d. Find courses with credits greater than `ANY` 3-credit course.  
e. Add `Date_of_Birth` to `Students`.  
f. Update an enrollment grade.

### 2. ER Diagram

Draw an ER diagram for a **Hospital Management System**.

---

## SET-3

### 1. Database Schema for a Sailors Database

**Sailors** (`sid`: integer, `sname`: string, `rating`: integer, `age`: real)

**Boats** (`bid`: integer, `bname`: string, `color`: string)

**Reserves** (`sid`: integer, `bid`: integer, `day`: date)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Find the names of sailors who have reserved boat number 103.  
d. Find the sailors with the highest rating.  
e. List all the sailors and boats who have reserved.  
f. Find the sailors who are eligible to vote.

### 2. ER Diagram

Draw an ER diagram for a **University Management System**.

---

## SET-4

### 1. Database Schema for a Sailors Database

**Sailors** (`sid`: integer, `sname`: string, `rating`: integer, `age`: real)

**Boats** (`bid`: integer, `bname`: string, `color`: string)

**Reserves** (`sid`: integer, `bid`: integer, `day`: date)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Find the names of sailors who have reserved a red and green boat.  
d. Find the average age of sailors for each rating level that has at least two sailors.  
e. Count the number of reservations.  
f. Find the `sid` of sailors who have reserved at least one boat.

### 2. ER Diagram

Draw an ER diagram for a **Roadway Travel System**.

---

## SET-5

### 1. Database Schema for `client_master` and `product_master`

**client_master**

- `client_no`: varchar, primary key
- `name`: varchar(20)
- `city`: varchar(15)
- `pin_code`: integer
- `state`: varchar(20)
- `bal_due`: integer

**product_master**

- `product_no`: varchar(10), primary key
- `description`: varchar(20)
- `profit_percent`: decimal(5,2)
- `unit_measure`: varchar(8)
- `qty_on_hand`: number(6)
- `reorder_lvl`: number(6)
- `selling_price`: number(10)
- `cost_price`: number(10)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Find out the names of all the clients.  
d. Display the information for client numbers 0001 and 0002.  
e. Find the list of all clients who stay in the city 'Bombay', 'Delhi', or 'Madras'.  
f. Find the product whose selling price is greater than 2000 and less than or equal to 5000.

### 2. ER Diagram

Draw an ER diagram for a **Hospital Management System**.

---

## SET-6

### 1. Database Schema for `client_master` and `product_master`

**client_master**

- `client_no`: varchar, primary key
- `name`: varchar(20)
- `city`: varchar(15)
- `pin_code`: integer
- `state`: varchar(20)
- `bal_due`: integer

**product_master**

- `product_no`: varchar(10), primary key
- `description`: varchar(20)
- `profit_percent`: decimal(5,2)
- `unit_measure`: varchar(8)
- `qty_on_hand`: number(6)
- `reorder_lvl`: number(6)
- `selling_price`: number(10)
- `cost_price`: number(10)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Retrieve the list of names and cities of all the clients.  
d. Display the information for client numbers 0001 and 0002.  
e. Find all the products whose selling price is greater than 5000.  
f. List the name, city, and state of clients not in the state of 'Maharashtra'.

### 2. ER Diagram

Draw an ER diagram for a **University Management System**.

---

## SET-7

### 1. Database Schema for a Roadway Travel System

**Passenger** (`Passenger_ID`, `Name`, `Age`, `Gender`, `Phone`, `Email`)

**Bus** (`Bus_ID`, `Bus_Number`, `Bus_Type`, `Capacity`, `Status`)

**Driver** (`Driver_ID`, `Driver_Name`, `License_Number`, `Phone`, `Experience`)

**Route** (`Route_ID`, `Source`, `Destination`, `Distance`, `Duration`)

**Schedule** (`Schedule_ID`, `Bus_ID`, `Route_ID`, `Driver_ID`, `Departure_Time`, `Arrival_Time`, `Travel_Date`)

**Booking** (`Booking_ID`, `Passenger_ID`, `Schedule_ID`, `Booking_Date`, `Seat_Number`, `Total_Fare`, `Booking_Status`)

**Payment** (`Payment_ID`, `Booking_ID`, `Payment_Date`, `Amount`, `Payment_Mode`, `Payment_Status`)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Display all passengers.  
d. Update a passenger's phone number.  
e. Find the average ticket fare.  
f. Display passengers who booked tickets.

### 2. ER Diagram

Draw an ER diagram for a **University Management System**.

---

## SET-8

### 1. Database Schema for a Roadway Travel System

**Passenger** (`Passenger_ID`, `Name`, `Age`, `Gender`, `Phone`, `Email`)

**Bus** (`Bus_ID`, `Bus_Number`, `Bus_Type`, `Capacity`, `Status`)

**Driver** (`Driver_ID`, `Driver_Name`, `License_Number`, `Phone`, `Experience`)

**Route** (`Route_ID`, `Source`, `Destination`, `Distance`, `Duration`)

**Schedule** (`Schedule_ID`, `Bus_ID`, `Route_ID`, `Driver_ID`, `Departure_Time`, `Arrival_Time`, `Travel_Date`)

**Booking** (`Booking_ID`, `Passenger_ID`, `Schedule_ID`, `Booking_Date`, `Seat_Number`, `Total_Fare`, `Booking_Status`)

**Payment** (`Payment_ID`, `Booking_ID`, `Payment_Date`, `Amount`, `Payment_Mode`, `Payment_Status`)

For the above schema, perform the following:

a. Create the tables with the appropriate integrity constraints.  
b. Insert around 5 records in each of the tables.  
c. Display buses having capacity greater than 40.  
d. Display passenger booking details.  
e. Find the average ticket fare.  
f. Display passengers who booked tickets.

### 2. ER Diagram

Draw an ER diagram for a **Hospital Management System**.
