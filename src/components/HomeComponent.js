import React, {Component} from 'react';
import { Jumbotron } from 'reactstrap';

class Home extends Component {
    render() {
        return(
            <div className="home">
                <Jumbotron className="row align-items-center">
                    <div className="container">
                        <div className="row justify-content-center align-items-center">
                            <div className="col-auto">
                                <h1>Useless App!</h1>
                            </div>
                        </div>
                    </div>
                </Jumbotron>
            </div>
        );
    }
}

export default Home;