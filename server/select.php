<?php

    echo json_encode(array(
        'success' => true,
        'total' => 2,
        'rows' => array(
            array(
                'PersonID' => 1,
                'FirstName' => 'Stuart',
                'LastName' => 'Ashworth',
                'Email' => 'stuart@swarmonline.com'
            ),
            array(
                'PersonID' => 2,
                'FirstName' => 'Andrew',
                'LastName' => 'Duncan',
                'Email' => 'andrew@swarmonline.com'
            )
        )
    ));

?>