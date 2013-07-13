<?php

    echo json_encode(array(
        'success' => true,
        'total' => 2,
        'rows' => array(
            array(
                'PersonID' => "10f54ef9-6c9d-4974-ae5d-70b463bfefff",
                'FirstName' => 'Stuart',
                'LastName' => 'Ashworth',
                'Email' => 'stuart@swarmonline.com'
            ),
            array(
                'PersonID' => "3b3aae5d-4108-4a45-bc35-d31b7874eb6b",
                'FirstName' => 'Andrew',
                'LastName' => 'Duncan',
                'Email' => 'andrew@swarmonline.com'
            )
        )
    ));

?>