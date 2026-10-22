<?php

return [
    'courier_codes' => [
        'jne', 'sicepat', 'ide', 'sap', 'jnt', 'ninja', 'tiki', 'lion',
        'anteraja', 'pos', 'ncs', 'rex', 'rpx', 'sentral', 'star', 'wahana',
        'dse', 'spx',
    ],
    'allowed_services' => [
        'jne' => ['REG'],
        'jnt' => ['EZ'],
    ],
    'excluded_services' => [
        'service_prefixes' => ['JTR', 'GOKIL'],
        'description_contains' => ['trucking', 'cargo'],
    ],
];
