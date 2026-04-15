select
     btr.code,
     btr.name,
     btr.as_of_date,
     btr.y1,
     btr.y2,
     btr.y3,
     btr.y4,
     btr.y5 
from benchmark_trailing_returns as btr 
order by btr.as_of_date desc 
limit 4;
