import { MigrationInterface, QueryRunner } from "typeorm";

export class InsertChain1662569194647 implements MigrationInterface {
  name = "InsertChain1662569194647";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `insert into chain (id, name, coin, symbol, format_digits) values ('0eedc701-547b-48a4-8a8b-7fdeb696af0c', 'Stacks', 'STX', 'Stacks', 6);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`delete from chain where id = '0eedc701-547b-48a4-8a8b-7fdeb696af0c'`);
  }
}
