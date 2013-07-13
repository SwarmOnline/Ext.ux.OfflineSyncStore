<?php

    $postValues = json_decode(file_get_contents("php://input"));


//    for($i = 0; $i < count($postValues); $i++){
//
//        $postValues[$i]->clientId = $postValues[$i]->PersonID;
//        $postValues[$i]->PersonID = $i + 3;
//    }

    echo json_encode(array(
        'success' => true,
        'rows' =>
            $postValues
    ));

?>