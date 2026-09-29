# Планы запросов до и после индексов

Снято `scripts/capture-explain.mjs` на PostgreSQL 16. В одной транзакции добавлены 20 000 единиц оборудования и 20 000 заявок, затем `EXPLAIN (ANALYZE, BUFFERS)` без индекса и с ним. Транзакция откатывается, данные не остаются.

## Фильтр списка оборудования по статусу и типу

`equipment_status_type_active_idx` на `(status, type) WHERE deleted_at IS NULL`.

Без индекса — последовательное чтение, 20 001 строка отброшена фильтром, 15.6 мс:

```text
Seq Scan on equipment  (cost=0.00..619.62 rows=1 width=16) (actual time=15.296..15.345 rows=40 loops=1)
  Filter: ((deleted_at IS NULL) AND (status = 'fault'::equipment_status) AND (type = 'inverter'::equipment_type))
  Rows Removed by Filter: 20001
  Buffers: shared hit=319
Execution Time: 15.641 ms
```

С индексом — `Index Scan`, 0.16 мс:

```text
Index Scan using equipment_status_type_active_idx on equipment  (cost=0.29..8.31 rows=1 width=16) (actual time=0.056..0.105 rows=40 loops=1)
  Index Cond: ((status = 'fault'::equipment_status) AND (type = 'inverter'::equipment_type))
  Buffers: shared hit=2 read=2
Execution Time: 0.163 ms
```

## Поиск оборудования по фрагменту названия

`equipment_name_trgm_idx`, `GIN` с `gin_trgm_ops`, условие `deleted_at IS NULL`. Запрос `name ILIKE '%турбина 15000%'`.

Без индекса — `Seq Scan`, 96.7 мс, просмотрены все строки:

```text
Seq Scan on equipment  (cost=0.00..569.51 rows=2 width=16) (actual time=72.289..96.712 rows=1 loops=1)
  Filter: ((deleted_at IS NULL) AND ((name)::text ~~* '%турбина 15000%'::text))
  Rows Removed by Filter: 20040
  Buffers: shared hit=319
Execution Time: 96.745 ms
```

С индексом — `Bitmap Index Scan`, 5.4 мс:

```text
Bitmap Heap Scan on equipment  (cost=99.64..107.19 rows=2 width=16) (actual time=5.017..5.050 rows=1 loops=1)
  Recheck Cond: (((name)::text ~~* '%турбина 15000%'::text) AND (deleted_at IS NULL))
  Heap Blocks: exact=1
  Buffers: shared hit=64
  ->  Bitmap Index Scan on equipment_name_trgm_idx  (cost=0.00..99.64 rows=2 width=0) (actual time=4.737..4.738 rows=1 loops=1)
        Index Cond: ((name)::text ~~* '%турбина 15000%'::text)
        Buffers: shared hit=63
Execution Time: 5.368 ms
```

## Список заявок по статусу с сортировкой по дате

`maintenance_requests_status_created_at_idx` на `(status, created_at DESC) WHERE deleted_at IS NULL`.

Без индекса — чтение всех 20 000 строк и сортировка, 38.4 мс:

```text
Limit  (cost=1127.19..1127.24 rows=20 width=24) (actual time=38.198..38.263 rows=20 loops=1)
  ->  Sort  (cost=1127.19..1177.19 rows=20000 width=24)
        Sort Key: created_at DESC
        Sort Method: top-N heapsort  Memory: 26kB
        ->  Seq Scan on maintenance_requests  (cost=0.00..595.00 rows=20000 width=24) (actual time=0.027..22.154 rows=20000 loops=1)
              Filter: ((deleted_at IS NULL) AND (status = 'new'::request_status))
Execution Time: 38.430 ms
```

С индексом — `Index Scan`, 0.21 мс, без отдельной сортировки:

```text
Limit  (cost=0.29..1.75 rows=20 width=24) (actual time=0.086..0.127 rows=20 loops=1)
  ->  Index Scan using maintenance_requests_status_created_at_idx on maintenance_requests  (cost=0.29..1465.79 rows=20000 width=24) (actual time=0.078..0.106 rows=20 loops=1)
        Index Cond: (status = 'new'::request_status)
Execution Time: 0.206 ms
```
