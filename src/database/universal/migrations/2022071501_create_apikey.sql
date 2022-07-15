-- insert row into migration table (use typeorm structure)

-- DDL and DML as required
CREATE TABLE public.apikey (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	client_name varchar(1000) NOT NULL,
	prefix varchar(7) NOT NULL,
	keyhash varchar(70) NOT NULL,
	created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT apikey_pk PRIMARY KEY (id)
);