<?php
Class Database {

	var $conn;
	
	function connect() {
		
		$user = 'root';
		$password = 'root';
		$db = 'records_db';
		$host = 'localhost';
		$socket = '/Applications/MAMP/tmp/mysql/mysql.sock';
		$port = 8889;

		$con = mysqli_connect($host, $user, $password, $db, $port, $socket) or die("Connection failed: " . mysqli_connect_error());

		if (mysqli_connect_errno()) {
			printf("Connection failed: %s\n", mysqli_connect_error());
			exit();
		} else {
			$this->conn = $con;
		}
		return $this->conn;
	}
}

?>
