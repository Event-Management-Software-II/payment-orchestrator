FROM postgres:16-alpine

ENV POSTGRES_DB=payment_gateway
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=admin

COPY schema.sql /docker-entrypoint-initdb.d/01_schema.sql
COPY seeds.sql  /docker-entrypoint-initdb.d/02_seeds.sql

EXPOSE 5432
