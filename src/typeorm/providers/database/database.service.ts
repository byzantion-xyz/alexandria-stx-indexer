import { DataSource } from "typeorm";

export const databaseProviders = [
  {
    provide: "DATA_SOURCE",
    useFactory: async () => {
      // const dataSource = new DataSource({
      //   type: "mysql",
      //   host: "localhost",
      //   port: 3306,
      //   username: "root",
      //   password: "root",
      //   database: "test",
      //   entities: [__dirname + "/../**/*.entities{.ts,.js}"],
      //   synchronize: true,
      // });
      const dataSource = new DataSource({
        url: "postgres://universal-staging-user:RpyHOdJXH6AyxkNUzz@34.168.241.120/byz-universal-postgres-staging",
        type: "postgres",
        // host: "34.168.241.120",
        // port: 5432,
        // username: "universal-staging-user",
        // password: "RpyHOdJXH6AyxkNUzz",
        // database: "byz-universal-postgres-staging",
        synchronize: false,
        logging: false,
        entities: [__dirname + "/../**/*.entities{.ts,.js}"],
        migrations: [],
        subscribers: [],
      });
      return dataSource.initialize();
    },
  },
];
