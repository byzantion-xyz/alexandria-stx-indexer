# Alexandria STX Indexer

## Overview

The Alexandria STX Indexer is the second service layer of the Alexandria open source platform. It indexes the transaction data stored in the STX Data Lake to create a database schema of opinionated state containing meta and state entities. This opinionated schema equips developers in the Stacks domain to start immediately with building value-add dapps without having to deal with the complexity of building an indexing layer.
It consists of 2 components:

- **The Service**: A smart contract Indexer service that transforms the raw transactions stored in the data lake into the opinionated schema.
- **The Database**: A smart contract opinionated database schema that stores meta, state, and actions (events) related to NFT smart contracts.

## Setup

Follow these setup steps to get going with the indexer. You can also watch starlord walking you through the setup in the following video https://www.loom.com/share/a02e448a7e3e47888df0f4121ab20771

The setup steps are also documented below. However, if you want to take the easy route and do a **1-click deploy**, then see the immediate optione below:

### 1-Click Render Deploy

This option makes it possible to deploy a full running instance of the Alexandria STX Indexer stack inside a set of hosted [render.com](https://render.com) services.

To get started, you will need to [register for a render account](https://dashboard.render.com/register) and get familiar with the [documentation for render](https://render.com/docs).

Once you've registered, hit this big blue button:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/byzantion-xyz/alexandria-stx-indexer&branch=main)

Important! Please note that this deployment uses paid starter plans for most of the services (you can upgrade as your needs require) and requires that you have payment details added to your account. Check the Render pricing for pricing information.

### 1. Dependencies

For proper functioning, the Indexer relies on a live instance of the [Alexandria STX Data Lake](https://github.com/byzantion-xyz/alexandria-stx-datalake) service and database. Refer to the [repository for the data lake here](https://github.com/byzantion-xyz/alexandria-stx-datalake) for instruction on how to get this setup.

### 2. Get the code

Clone this repo onto you drive to run the indexer locally, or fork the repo for deploying to a server environment.

### 3. PostgreSQL database

Create a new PostgreSQL database that will be the target database for your indexer instance. This will hold the data model for the smart contracts, NFT meta and state as well as actions (events).

### 4. Environment variables

Before runnign the indexer, you will need a few environment variables to be in place. To run locally,make a copy of the `config.env.example` file, rename it to `.env` and add the variable. For running in a server environment, make sure the variables are set using the environment variable mechanism used by that service.

These are the require variables:

- `STACKS_STREAMER_SQL_DATABASE_URL` - this must be set to the database connection URL for the Alexandria STX Data Lake database that you created under the dependencies section.
- `DATABASE_URL` - this must be set to the database connection URL for the new PostgreSQL database you created above.
- `RUN_SEED` - this must be set true if you want the seed migration to run as part of the initial migration.

### 5. Migrations

Once your environment variable are configured, run the database migrations in order to prepare the indexer database for action. If you have enabled the data seeding, it will take a bit of time:

```
yarn m:run
```

When the migrations are complete, the indexer service should be good to go.

### 6. Indexing from the stacks blockchain tip

The first use case is to index from the chain tip. This is automatic and simply requires the service to be running.

To run the indexer locally:

```
yarn start
```

To run the indexer in production:

```
yarn start:prod
```

### 7. Indexing historical transactions

The second use case is to index historical transactions. Ensure that the indexer service is running (as per the previous section) and then hit an endpoint to instruct it to index historical transactions based on settings inside a json body object.

Here are some examples:

Index 5000 blocks for a specific smart contract

```
curl --location --request POST 'localhost:5002/indexer/run' \
--header 'Content-Type: application/json' \
--data-raw '{
    "contract_key": "SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335.megapont-ape-club-nft",
    "start_block_height": 70000,
    "end_block_height": 75000
}'
```

Index 10000 blocks for all mapped smart contracts

```
curl --location --request POST 'localhost:5002/indexer/run' \
--header 'Content-Type: application/json' \
--data-raw '{
    "start_block_height": 60000,
    "end_block_height": 70000
}'
```

## Data Model Diagram

![alx_universal_erd](https://user-images.githubusercontent.com/97109970/189184600-a247040b-edbd-4ad2-accd-65c18e73fb36.png)
