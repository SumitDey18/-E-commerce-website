# E-Commerce EJS Complete V3

Beginner-friendly e-commerce project using:

- Node.js
- Express.js
- MongoDB + Mongoose
- EJS
- CSS
- express-session
- bcryptjs
- Multer image upload
- Customer / Host / Admin role-based authentication
- OTP verification
- Optional Nodemailer email OTP
- Delivery address
- Browser GPS location
- Razorpay TEST payment
- Cash on Delivery
- Order tracking
- Admin order status management
- Admin user role management
- Admin can upload, update and delete products

## 1. Install

Open PowerShell inside this folder:

```powershell
npm install
```

## 2. Start MongoDB

Make sure local MongoDB is running.

The default database URL is:

`mongodb://127.0.0.1:27017/shoppingDB`

You can change it in `.env`.

## 3. Create `.env`

Copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

For basic testing you only need:

```env
MONGO_URL=mongodb://127.0.0.1:27017/shoppingDB
SESSION_SECRET=my_super_secret_key
PORT=3000
```

OTP will appear in the terminal if SMTP is not configured.

## 4. Create Admin Easily

You do NOT need to edit MongoDB Compass manually.

Run:

```powershell
npm run admin
```

Enter:

```text
Admin name: Sumit
Admin email: admin@gmail.com
Admin password: admin123
```

The account is automatically created as:

```text
role = admin
isVerified = true
```

Then run:

```powershell
npm start
```

Login at:

`http://localhost:3000/customer/login`

The admin is redirected to:

`http://localhost:3000/admin`

## 5. Host

A normal registered user starts as `customer`.

An admin can change a user's role from the Admin Dashboard:

`customer -> host`

After changing the role, logout and login again.

The host goes to:

`http://localhost:3000/host`

## 6. Admin Product Upload

Admin upload is supported.

Admin Dashboard -> Upload Product

or:

`http://localhost:3000/host/upload`

The upload route accepts both `host` and `admin`.

Admin can also update and delete every product.

## 7. Multer

Images are stored in:

`uploads/`

Allowed:

- JPG
- JPEG
- PNG
- WEBP

Maximum size: 5 MB.

## 8. OTP

During normal customer registration an OTP is generated.

If SMTP is not configured, look at the VS Code terminal:

```text
OTP for user@gmail.com: 123456
```

Enter that OTP on the verification page.

For real email OTP, fill SMTP settings in `.env`.

## 9. Location

Checkout contains **Use My Current Location**.

The browser asks for location permission. Latitude and longitude are saved with the order.

Admin and customer can open the saved location in Google Maps.

## 10. Payment

Checkout has:

- Razorpay Online
- Cash on Delivery

For Razorpay, put your REAL TEST credentials in `.env`:

```env
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

Never put your secret key in EJS or frontend JavaScript.

If Razorpay keys are missing, choose Cash on Delivery or add the TEST keys and restart the server.

## 11. Why an order can show `pending`

`pending` means the order was created but payment has not been successfully verified yet.

After successful Razorpay signature verification, the project changes:

```text
paymentStatus = paid
status = confirmed
```

For COD:

```text
paymentStatus = cod
status = confirmed
```

## 12. Important startup fix

This version waits for MongoDB before starting Express.

So you will NOT get the confusing situation where the server accepts requests while Mongoose is disconnected and later shows:

`Operation users.findOne() buffering timed out after 10000ms`

If MongoDB is stopped, the app prints the MongoDB error and does not start the web server.

## 13. Start

```powershell
npm install
npm run admin
npm start
```

Or if you already created the admin:

```powershell
npm start
```

Open:

`http://localhost:3000`


## Added in this version

- Product search by name, description and category
- Category filter
- Minimum/maximum price filter
- Price sorting
- Cart plus/minus quantity controls
- Cart stock validation on every update
- Live cart total in the browser
- Admin statistics: users, products, orders, sales, pending, delivered and cancelled
- Razorpay payment failure and cancellation handling
- Duplicate payment verification protection
- Automatic stock reduction only after successful payment/COD confirmation
- Razorpay refund from Admin for successful online payments
- Refund status shown in the admin dashboard


## Gmail OTP setup

1. Turn on 2-Step Verification for your Google account.
2. Create a Google App Password for this project.
3. Copy `.env.example` to `.env`.
4. Set `SMTP_USER` to your Gmail address.
5. Set `SMTP_PASS` to the 16-character Google App Password.
6. Set `OTP_FROM` to the same Gmail address.
7. Restart the Node server.

If SMTP_USER/SMTP_PASS are empty, the project intentionally falls back to printing the OTP in the terminal for local development.

OTP security: the OTP is stored as a SHA-256 hash, expires after 5 minutes, allows 5 attempts, and resend is limited to once every 60 seconds.
