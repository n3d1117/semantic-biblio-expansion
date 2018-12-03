SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

CREATE TABLE IF NOT EXISTS `records` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` text NOT NULL,
  `subject` text NOT NULL,
  `creator` text NOT NULL,
  `contributor` text NOT NULL,
  `date` text NOT NULL,
  `description` text NOT NULL,
  `language` text NOT NULL,
  `publisher` text NOT NULL,
  `type` text NOT NULL,
  `format` text NOT NULL,
  `relation` text NOT NULL,
  `link` text NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;