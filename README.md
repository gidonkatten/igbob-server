# Issuing Green Bonds On Algorand Blockchain - Backend

Frontend can be found at https://github.com/gidonkatten/igbob and smart contract testing at https://github.com/gidonkatten/algo-green-bond.

## Requirements
* Linux or macOS
* Python 3
* NPM

## Setup
To install all required packages, run:
```
python3 -m pip install -r requirements.txt
```
```
npm install
```

Also have to supply your own funded Algorand account in environment file `ALGOD_ACCOUNT_MNEMONIC = "..."`.

## Usage
To run locally use command `node index` .

## Database
Makes use of private PostgreSQL database - see `db.js`. 
