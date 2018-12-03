<?php

include("./config.php");

$db = new Database();
$connection =  $db->connect();

$request_method=$_SERVER["REQUEST_METHOD"];

switch($request_method) {
	case 'GET':
		get_records();
		break;
	default:
		header("HTTP/1.0 405 Method Not Allowed");
		break;
}

function get_records() {
	global $connection;
	$query="SELECT * FROM records";
	$records=array();
	$result=mysqli_query($connection, $query);
	
	while($row=mysqli_fetch_array($result)) {
      $record = array('id' => $row['id'], 'title' => $row['title'], 'subject' => $row['subject'], 'creator' => $row['creator'], 
							 'contributor' => $row['contributor'], 'date' => $row['date'], 'description' => $row['description'], 'language' => $row['language'],
							 'publisher' => $row['publisher'], 'type' => $row['type'], 'format' => $row['format'], 'relation' => $row['relation'], 'link' => $row['link']);
      array_push($records, $record);
	}
	header('Content-Type: application/json');
	echo json_encode(array('records' => $records));
}

?>
